// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// RosaeFinity Animation Engine â€” Animation Manager
// v3.1 Architecture Spec (Frozen)
//
// Core engine: play, pause, resume, cancel, queue, timeline.
// All animations use CSS transitions for GPU acceleration.
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

import type {
  AnimationDefinition, AnimationInstance, AnimationState,
  AnimationDiagnostics, QueueEntry, AnimationGroup, EasingType,
} from './AnimationTypes';
import { getAnimationPreset } from './AnimationPresets';

// â”€â”€â”€ Easing Map (CSS cubic-bezier approximations) â”€â”€â”€

const EASING_MAP: Record<EasingType, string> = {
  linear: 'linear',
  ease: 'ease',
  'ease-in': 'ease-in',
  'ease-out': 'ease-out',
  'ease-in-out': 'ease-in-out',
  spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
  bounce: 'cubic-bezier(0.68, -0.55, 0.27, 1.55)',
  elastic: 'cubic-bezier(0.68, -0.6, 0.32, 1.6)',
  back: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
  expo: 'cubic-bezier(0.16, 1, 0.3, 1)',
  cubic: 'cubic-bezier(0.33, 0, 0.67, 1)',
  quart: 'cubic-bezier(0.25, 1, 0.5, 1)',
  quint: 'cubic-bezier(0.22, 1, 0.36, 1)',
};

// â”€â”€â”€ Unique ID Generator â”€â”€â”€

let nextId = 0;
function generateId(): string {
  return `anim-${Date.now()}-${nextId++}`;
}

// â”€â”€â”€ Animation Manager â”€â”€â”€

export class AnimationManager {
  private running = new Map<string, AnimationInstance>();
  private _queue: QueueEntry[] = [];
  private groups = new Map<string, AnimationGroup>();
  private completedCount = 0;
  private droppedFrames = 0;
  private fpsHistory: number[] = [];
  private lastFrameTime = 0;
  private frameRafId = 0;
  private performanceMode = false;
  private reducedMotion = false;

  constructor() {
    if (typeof window !== 'undefined') {
      this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }
  }

  // â”€â”€â”€ Core API â”€â”€â”€

  /**
   * Play an animation on an element.
   * Returns the animation instance ID.
   */
  play(
    definitionOrPresetId: AnimationDefinition | string,
    targetElement: HTMLElement,
    options?: {
      delay?: number;
      speed?: number;
      onComplete?: () => void;
      onCancel?: () => void;
    },
  ): string {
    let definition: AnimationDefinition;

    if (typeof definitionOrPresetId === 'string') {
      const preset = getAnimationPreset(definitionOrPresetId);
      if (!preset) {
        console.warn(`[AnimationManager] Unknown preset: "${definitionOrPresetId}"`);
        return '';
      }
      definition = { ...preset.definition, id: preset.id };
    } else {
      definition = definitionOrPresetId;
    }

    // Reduced motion: skip non-loop animations
    if (this.reducedMotion && definition.category !== 'loop') {
      options?.onComplete?.();
      return '';
    }

    const id = generateId();
    const speed = options?.speed ?? 1;
    const adjustedDuration = definition.duration / speed;
    const adjustedDelay = (definition.delay + (options?.delay ?? 0)) / speed;

    const instance: AnimationInstance = {
      id,
      definition: { ...definition, duration: adjustedDuration, delay: adjustedDelay },
      state: 'running',
      startTime: performance.now() + adjustedDelay,
      currentTime: 0,
      progress: 0,
      iteration: 0,
      targetElement,
      onComplete: options?.onComplete,
      onCancel: options?.onCancel,
    };

    // Apply animation via CSS transitions
    this.applyAnimation(instance, targetElement);

    this.running.set(id, instance);

    // Auto-remove after completion
    const totalTime = adjustedDuration + adjustedDelay;
    setTimeout(() => {
      const inst = this.running.get(id);
      if (inst && inst.state === 'running') {
        inst.state = 'completed';
        this.completedCount++;
        this.running.delete(id);
        inst.onComplete?.();
        this.processQueue();
      }
    }, totalTime);

    return id;
  }

  /**
   * Play a preset animation by ID.
   */
  playPreset(
    presetId: string,
    targetElement: HTMLElement,
    options?: { delay?: number; speed?: number; onComplete?: () => void; onCancel?: () => void },
  ): string {
    return this.play(presetId, targetElement, options);
  }

  /**
   * Pause a running animation.
   */
  pause(id: string): void {
    const instance = this.running.get(id);
    if (instance && instance.state === 'running') {
      instance.state = 'paused';
      if (instance.targetElement) {
        instance.targetElement.style.animationPlayState = 'paused';
      }
    }
  }

  /**
   * Resume a paused animation.
   */
  resume(id: string): void {
    const instance = this.running.get(id);
    if (instance && instance.state === 'paused') {
      instance.state = 'running';
      if (instance.targetElement) {
        instance.targetElement.style.animationPlayState = 'running';
      }
    }
  }

  /**
   * Cancel a running or paused animation.
   */
  cancel(id: string): void {
    const instance = this.running.get(id);
    if (instance) {
      instance.state = 'cancelled';
      if (instance.targetElement) {
        instance.targetElement.style.animation = '';
        instance.targetElement.style.animationPlayState = '';
      }
      this.running.delete(id);
      instance.onCancel?.();
    }
  }

  /**
   * Cancel all running animations.
   */
  cancelAll(): void {
    for (const [id] of this.running) {
      this.cancel(id);
    }
    this._queue = [];
  }

  /**
   * Restart a completed or cancelled animation.
   */
  restart(id: string): void {
    const instance = this.running.get(id);
    if (instance && (instance.state === 'completed' || instance.state === 'cancelled')) {
      instance.state = 'running';
      instance.startTime = performance.now();
      instance.progress = 0;
      instance.iteration = 0;
      this.applyAnimation(instance, instance.targetElement);
    }
  }

  // â”€â”€â”€ Queue â”€â”€â”€

  /**
   * Queue an animation to play after the current one finishes.
   */
  queue(definition: AnimationDefinition, targetElement: HTMLElement, priority: number = 0): string {
    const id = generateId();
    this.queue.push({ id, definition, targetElement, priority });
    this.queue.sort((a, b) => b.priority - a.priority);

    // If nothing is running, process queue immediately
    if (this.running.size === 0) {
      this.processQueue();
    }

    return id;
  }

  /**
   * Process the next item in the queue.
   */
  private processQueue(): void {
    if (this.queue.length === 0) return;

    const entry = this.queue.shift()!;
    this.play(entry.definition, entry.targetElement, {
      onComplete: entry.onComplete,
    });
  }

  // â”€â”€â”€ Groups â”€â”€â”€

  /**
   * Create an animation group.
   */
  createGroup(name: string): string {
    const id = generateId();
    this.groups.set(id, {
      id, name, instances: [], startTime: performance.now(), state: 'idle',
    });
    return id;
  }

  /**
   * Add an animation to a group.
   */
  addToGroup(groupId: string, definition: AnimationDefinition, targetElement: HTMLElement): string {
    const group = this.groups.get(groupId);
    if (!group) return '';

    const animId = this.play(definition, targetElement, {
      onComplete: () => {
        group.instances = group.instances.filter(i => i.id !== animId);
        if (group.instances.length === 0) {
          group.state = 'completed';
        }
      },
    });

    const instance = this.running.get(animId);
    if (instance) {
      group.instances.push(instance);
      group.state = 'running';
    }

    return animId;
  }

  // â”€â”€â”€ Batch Operations â”€â”€â”€

  /**
   * Play multiple animations simultaneously.
   */
  playMany(
    animations: Array<{ definition: AnimationDefinition | string; target: HTMLElement }>,
  ): string[] {
    return animations.map(a => this.play(a.definition, a.target));
  }

  /**
   * Cancel all animations on a specific element.
   */
  cancelElement(element: HTMLElement): void {
    for (const [id, instance] of this.running) {
      if (instance.targetElement === element) {
        this.cancel(id);
      }
    }
  }

  /**
   * Pause all running animations.
   */
  pauseAll(): void {
    for (const [id, instance] of this.running) {
      if (instance.state === 'running') {
        this.pause(id);
      }
    }
  }

  /**
   * Resume all paused animations.
   */
  resumeAll(): void {
    for (const [id, instance] of this.running) {
      if (instance.state === 'paused') {
        this.resume(id);
      }
    }
  }

  // â”€â”€â”€ Query â”€â”€â”€

  isRunning(id: string): boolean {
    const instance = this.running.get(id);
    return instance?.state === 'running';
  }

  getRunningCount(): number {
    return Array.from(this.running.values()).filter(i => i.state === 'running').length;
  }

  // â”€â”€â”€ Performance â”€â”€â”€

  setPerformanceMode(enabled: boolean): void {
    this.performanceMode = enabled;
  }

  setReducedMotion(enabled: boolean): void {
    this.reducedMotion = enabled;
    if (enabled) {
      this.cancelAll();
    }
  }

  // â”€â”€â”€ Diagnostics â”€â”€â”€

  getDiagnostics(): AnimationDiagnostics {
    const running = Array.from(this.running.values()).filter(i => i.state === 'running');
    const paused = Array.from(this.running.values()).filter(i => i.state === 'paused');

    return {
      runningCount: running.length,
      queuedCount: this.queue.length,
      completedCount: this.completedCount,
      droppedFrames: this.droppedFrames,
      averageFps: this.fpsHistory.length > 0
        ? this.fpsHistory.reduce((a, b) => a + b, 0) / this.fpsHistory.length
        : 0,
      frameTime: this.lastFrameTime,
      totalAnimations: this.completedCount + running.length + paused.length,
    };
  }

  // â”€â”€â”€ Cleanup â”€â”€â”€

  destroy(): void {
    this.cancelAll();
    this.groups.clear();
    cancelAnimationFrame(this.frameRafId);
  }

  // â”€â”€â”€ Private â”€â”€â”€

  private applyAnimation(instance: AnimationInstance, element: HTMLElement): void {
    if (!element || this.performanceMode) return;

    const { definition } = instance;
    const durationMs = definition.duration;
    const delayMs = definition.delay;
    const easing = EASING_MAP[definition.easing] ?? 'ease';

    // Build CSS transition properties
    const properties = new Set<string>();
    for (const kf of definition.keyframes) {
      for (const prop of Object.keys(kf.properties)) {
        properties.add(prop);
      }
    }

    // Use CSS animation for complex multi-keyframe animations
    if (definition.keyframes.length > 2 || definition.repeat !== 0) {
      const cssKeyframes = definition.keyframes.map((kf, i) => {
        const pct = definition.keyframes.length > 1 ? (i / (definition.keyframes.length - 1)) * 100 : 0;
        const props = Object.entries(kf.properties)
          .map(([k, v]) => `${k}: ${v}`)
          .join('; ');
        return `${pct}% { ${props} }`;
      }).join('\n');

      const animName = `rf-anim-${instance.id}`;
      const style = document.createElement('style');
      style.textContent = `@keyframes ${animName} { ${cssKeyframes} }`;
      document.head.appendChild(style);

      const iterationCount = definition.repeat === -1 ? 'infinite' : Math.max(1, definition.repeat + 1);
      element.style.animation = `${animName} ${durationMs}ms ${easing} ${delayMs}ms ${iterationCount} ${definition.direction} ${definition.fillMode}`;

      // Cleanup style element after animation
      const totalTime = durationMs + delayMs;
      setTimeout(() => {
        style.remove();
        element.style.animation = '';
      }, definition.repeat === -1 ? 0 : totalTime * iterationCount);
    } else {
      // Simple 2-keyframe: use CSS transition
      const firstKf = definition.keyframes[0];
      const lastKf = definition.keyframes[1] ?? definition.keyframes[0];

      const transitionProps = Object.keys(firstKf.properties)
        .map(p => `${p} ${durationMs}ms ${easing} ${delayMs}ms`)
        .join(', ');

      element.style.transition = transitionProps;

      // Apply initial state
      for (const [prop, value] of Object.entries(firstKf.properties)) {
        (element.style as Record<string, unknown>)[prop] = value;
      }

      // Force reflow
      element.offsetHeight;

      // Apply final state
      requestAnimationFrame(() => {
        for (const [prop, value] of Object.entries(lastKf.properties)) {
          (element.style as Record<string, unknown>)[prop] = value;
        }
      });

      // Cleanup transition after completion
      setTimeout(() => {
        element.style.transition = '';
      }, durationMs + delayMs + 50);
    }
  }
}

// â”€â”€â”€ Singleton â”€â”€â”€

let _manager: AnimationManager | null = null;

export function getAnimationManager(): AnimationManager {
  if (!_manager) _manager = new AnimationManager();
  return _manager;
}
