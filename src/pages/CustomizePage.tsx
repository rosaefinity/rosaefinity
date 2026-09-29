import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { getOverlayModule } from '../overlays/registry';
import { useOverlayStore } from '../lib/overlay-store';
import { SchemaSettings } from '../components/SchemaSettings';
import { getBrowserSourceUrl, getSSEBaseUrl } from '../lib/browser-source-url';
import {
  ArrowLeft, Copy, Check, ExternalLink, FlaskConical,
} from 'lucide-react';
import { sendToOverlay } from '../lib/overlay-bus';
import { useGoalStore } from '../store/goal-store';
import { useAppStore } from '../store/app-store';
import { executeAction } from '../store/event-dispatch';

export function CustomizePage() {
  // ── 1. Route params ──
  const { instanceId } = useParams<{ instanceId: string }>();
  const navigate = useNavigate();
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [testing, setTesting] = useState(false);

  // ── 2. Store access ──
  const instances = useOverlayStore((s) => s.instances);
  const updateConfig = useOverlayStore((s) => s.updateConfig);
  const addInstance = useOverlayStore((s) => s.addInstance);
  const currentProfileId = useAppStore((s) => s.currentProfileId);

  // ── 3. Instance lookup ──
  const resolved = useMemo(() => {
    // Filter instances to only those belonging to the current profile
    const profileInstances = instances.filter((i) => i.profileId === currentProfileId);

    let inst = profileInstances.find((i) => i.id === instanceId);
    if (inst) return { instance: inst, mod: getOverlayModule(inst.moduleId) };
    inst = profileInstances.find((i) => i.moduleId === instanceId);
    if (inst) return { instance: inst, mod: getOverlayModule(inst.moduleId) };
    // Direct module lookup (for routes like /customize/goal-followers)
    const mod = getOverlayModule(instanceId ?? '');
    return { instance: null, mod: mod ?? undefined };
  }, [instances, instanceId, currentProfileId]);

  const instance = resolved.instance;
  const mod = resolved.mod;

  // ── 4. Ref to latest instance (safe: declared AFTER instance) ──
  const instanceRef = useRef(instance);
  instanceRef.current = instance;

  // ── 5. Overlay metadata ──
  const isGoalProgress = mod?.id === 'goal-progress';
  const isGoalModule = isGoalProgress || mod?.id === 'goal-likes' || mod?.id === 'goal-followers' || mod?.id === 'goal-gifts';

  // ── 6. Auto-create instance for goal modules that support browser source ──
  // This ensures a Browser Source URL is available on first visit
  useEffect(() => {
    if (!mod || instance) return; // Module doesn't exist or instance already exists
    if (!mod.supportsBrowserSource) return; // Module doesn't support browser source
    if (!isGoalModule) return; // Only auto-create for goal modules

    // Create instance using existing overlay store mechanism
    const created = addInstance({
      moduleId: mod.id,
      name: mod.name,
      enabled: true,
      config: mod.defaultConfig as Record<string, unknown>,
      configVersion: mod.configVersion ?? 1,
    });
    instanceRef.current = created as any;
  }, [mod, instance, isGoalModule, addInstance]);

  // ── 6. Effective config ──
  const effectiveConfig = useMemo(() => {
    const base = mod?.defaultConfig ?? {};
    const instanceCfg = instance?.config ?? {};
    return { ...base, ...instanceCfg };
  }, [instance, mod]);

  // ── 7. Flat schema ──
  const flatSchema = useMemo(() => {
    if (!mod) return [];
    const raw = mod.settingsSchema;
    if (!Array.isArray(raw) || raw.length === 0) return [];
    const first = raw[0] as Record<string, unknown>;
    if (first && 'fields' in first && Array.isArray(first.fields)) {
      return raw.flatMap((section: any) =>
        (section.fields as any[]).map((field: any) => ({
          ...field,
          section: section.title ?? section.section ?? 'General',
        }))
      );
    }
    return raw;
  }, [mod]);

  // ── 8. Action dropdown options (for Goal modules only) ──
  const flatSchemaWithActions = useMemo(() => {
    if (!isGoalModule) return flatSchema;
    const actions = useAppStore.getState().actions.filter((a) => a.enabled);
    const actionOptions = [
      { value: '', label: 'No action' },
      ...actions.map((a) => ({ value: a.id, label: a.name })),
    ];
    return flatSchema.map((f: any) =>
      f.key === 'actionId' ? { ...f, options: actionOptions } : f
    );
  }, [flatSchema, isGoalModule]);

  // ── 9. Config change handler ──
  const handleConfigChange = useCallback(
    (key: string, value: unknown) => {
      const inst = instanceRef.current;
      if (inst) {
        updateConfig(inst.id, { ...inst.config, [key]: value });
      } else if (mod) {
        // No instance yet — create one on first change
        const newConfig = { ...(mod.defaultConfig as Record<string, unknown>), [key]: value };
        const created = addInstance({
          moduleId: mod.id,
          name: mod.name,
          enabled: true,
          config: newConfig,
          configVersion: 1,
        });
        instanceRef.current = created as any;
      }
    },
    [mod, updateConfig, addInstance]
  );

  // ── 10. Sync behavioral settings to Goal store (legacy goal-progress only) ──
  useEffect(() => {
    if (!isGoalProgress || !instance) return;
    const cfg = instance.config as Record<string, unknown>;
    const goalStore = useGoalStore.getState();
    const goals = goalStore.goals;
    if (goals.length === 0) return;

    // ── Association: find the Goal bound to this overlay instance ──
    // Every step requires EXACTLY ONE match. Ambiguity = no Goal found.
    let goal: typeof goals[0] | undefined;
    let ambiguous = false;

    // Step 1: Use formal goalId link if present in config
    if (cfg.goalId) {
      goal = goals.find((g) => g.id === cfg.goalId);
      // goalId points to a deleted Goal — treat as no association
    }

    // Step 2: If no goalId, find by title+target — ONLY if exactly one matches
    if (!goal) {
      const matches = goals.filter((g) => g.title === cfg.title && g.target === cfg.target);
      if (matches.length === 1) {
        goal = matches[0];
      } else if (matches.length > 1) {
        ambiguous = true;
      }
    }

    // Step 3: If no title+target match, find by goalType — ONLY if exactly one matches
    if (!goal && !ambiguous) {
      const matches = goals.filter((g) => g.type === cfg.goalType);
      if (matches.length === 1) {
        goal = matches[0];
      } else if (matches.length > 1) {
        ambiguous = true;
      }
    }

    // No deterministic association found — do NOT modify any Goal
    if (!goal) {
      if (ambiguous) {
        console.warn('[GOAL-ASSOC] Ambiguous: multiple Goals match overlay', {
          instanceId: instance.id,
          moduleId: instance.moduleId,
          goalType: cfg.goalType,
          title: cfg.title,
          target: cfg.target,
        });
      }
      return;
    }

    // ── Persist the association into the overlay config ──
    if (cfg.goalId !== goal.id) {
      updateConfig(instance.id, { ...instance.config, goalId: goal.id } as Record<string, unknown>);
    }

    // ── Normalize Goal type to 'likes' (goal-progress is always a Likes goal) ──
    // Migrates legacy 'followers' or 'gifts' goals on first load
    if (goal.type !== 'likes') {
      goalStore.updateGoal(goal.id, { type: 'likes' });
      goalStore.resetGoalCurrent(goal.id);
      return; // resetGoalCurrent broadcasts current=0
    }

    // ── Sync behavioral settings from overlay config to Goal ──
    const updates: Record<string, unknown> = {};
    if (cfg.reachedBehavior && cfg.reachedBehavior !== goal.reachedBehavior) {
      updates.reachedBehavior = cfg.reachedBehavior;
    }
    if ((cfg.actionId ?? null) !== (goal.actionId ?? null)) {
      updates.actionId = cfg.actionId ?? null;
    }
    if (cfg.target && typeof cfg.target === 'number' && cfg.target !== goal.target) {
      updates.target = cfg.target;
    }
    // Sync color settings from overlay config to legacy Goal object
    if (typeof cfg.barColor === 'string' && cfg.barColor !== goal.barColor) {
      updates.barColor = cfg.barColor;
    }
    if (typeof cfg.gradientColor === 'string' && cfg.gradientColor !== goal.gradientColor) {
      updates.gradientColor = cfg.gradientColor;
    }
    if (typeof cfg.textColor === 'string' && cfg.textColor !== goal.textColor) {
      updates.textColor = cfg.textColor;
    }
    if (typeof cfg.backgroundColor === 'string' && cfg.backgroundColor !== goal.backgroundColor) {
      updates.backgroundColor = cfg.backgroundColor;
    }
    if (Object.keys(updates).length > 0) {
      goalStore.updateGoal(goal.id, updates);
    }
  }, [isGoalProgress, instance?.config]);

  // ── 11. Browser source URL ──
  const browserSourceUrl = useMemo(() => {
    // All goal modules (including Goal Likes) use instance-based URLs
    if (isGoalModule && instance) return getBrowserSourceUrl(instance.browserSourceId);
    return instance ? getBrowserSourceUrl(instance.browserSourceId) : '';
  }, [isGoalModule, instance, mod?.id]);

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(browserSourceUrl);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  // ── 12. Test simulation ──
  const testIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopTest = useCallback(() => {
    if (testIntervalRef.current) {
      clearInterval(testIntervalRef.current);
      testIntervalRef.current = null;
    }
    setTesting(false);
  }, []);

  const handleTest = useCallback(() => {
    if (!isGoalModule) return;
    // If already testing, stop it
    if (testIntervalRef.current) {
      stopTest();
      return;
    }
    setTesting(true);
    const cfg = effectiveConfig;
    const target = (cfg.target as number) ?? 7000;
    const goalType = (cfg.goalType as string) ?? 'likes';
    const title = (cfg.title as string) ?? 'Goal';
    const barColor = (cfg.barColor as string) ?? '#8b5cf6';
    const reachedBehavior = (cfg.reachedBehavior as string) ?? 'increase';
    const actionId = (cfg.actionId as string) ?? null;
    console.log('[GOAL-TEST] test started:', { actionId, target, reachedBehavior });
    const steps = Math.min(80, Math.max(20, target));
    const stepDuration = Math.max(60, Math.round(7000 / steps));
    const increment = target / steps;
    let step = 0;

    sendToOverlay({ type: 'goal-progress', current: 0, target, goalType, title, barColor } as any);

    testIntervalRef.current = setInterval(() => {
      step++;
      const isLast = step >= steps;
      const current = isLast ? target : Math.min(target, Math.round(increment * step));
      sendToOverlay({ type: 'goal-progress', current, target, goalType, title, barColor } as any);

      if (isLast && testIntervalRef.current) {
        clearInterval(testIntervalRef.current);
        testIntervalRef.current = null;
        setTesting(false);
        console.log('[GOAL-COMPLETE] target reached:', { target, actionId });
        if (actionId) {
          const actions = useAppStore.getState().actions;
          const action = actions.find((a) => a.id === actionId);
          console.log('[GOAL-ACTION] lookup:', { actionId, found: !!action, actionName: action?.name, enabled: action?.enabled, totalActions: actions.length });
          if (action && action.enabled) {
            try {
              console.log('[GOAL-ACTION] executing:', action.name);
              executeAction(action, { type: 'goal-reached', user: 'Test', goalTitle: title, goalType, timestamp: Date.now() });
              console.log('[GOAL-ACTION] execution started');
            } catch (err) {
              console.error('[GOAL-ACTION] execution error:', err);
            }
          } else {
            console.warn('[GOAL-ACTION] action not found or disabled:', { actionId, found: !!action, enabled: action?.enabled });
          }
        } else {
          console.log('[GOAL-TEST] no actionId configured');
        }
        const goals = useGoalStore.getState().goals;
        const goal = goals.find((g) => g.enabled);
        if (goal) {
          if (reachedBehavior === 'increase') {
            useGoalStore.getState().updateGoal(goal.id, { target: goal.target + goal.target });
            useGoalStore.getState().updateRuntime(goal.id, { current: 0, reached: false, lastCompletedTarget: 0 });
            useGoalStore.getState().broadcastGoalProgress(goal.id);
          } else if (reachedBehavior === 'double') {
            useGoalStore.getState().updateGoal(goal.id, { target: goal.target * 2 });
            useGoalStore.getState().updateRuntime(goal.id, { current: 0, reached: false, lastCompletedTarget: 0 });
            useGoalStore.getState().broadcastGoalProgress(goal.id);
          }
        }
      }
    }, stepDuration);
  }, [isGoalModule, effectiveConfig, stopTest]);

  useEffect(() => {
    return () => { if (testIntervalRef.current) clearInterval(testIntervalRef.current); };
  }, []);

  // ── Early return AFTER all hooks ──
  if (!mod) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-white/40">Overlay not found.</p>
      </div>
    );
  }

  const Renderer = mod.renderer;
  const ModIcon = mod.icon;

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-4xl mx-auto px-6 py-6">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <button onClick={() => navigate('/overlays')}
            className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/60 transition-colors mb-3">
            <ArrowLeft className="w-3.5 h-3.5" />Back to Gallery
          </button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center border border-primary/30">
              <ModIcon className="w-5 h-5 text-primary-light" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">{instance?.name ?? mod.name}</h1>
              <p className="text-xs text-white/40 capitalize">{mod.category} overlay</p>
            </div>
          </div>
        </motion.div>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-white">Preview</h2>
                <div className="flex gap-1">
                  <button className="w-8 h-8 rounded-lg flex items-center justify-center text-white/30 hover:text-white hover:bg-white/[0.06] transition-all" title="Open in Browser Source">
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={handleTest} className="w-8 h-8 rounded-lg flex items-center justify-center text-white/30 hover:text-white hover:bg-white/[0.06] transition-all" title="Test Overlay">
                    <FlaskConical className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <div className={`relative rounded-xl border border-white/[0.08] bg-[#050505] overflow-hidden ${isGoalModule ? 'aspect-[9/16]' : 'aspect-video'}`} style={isGoalModule ? { containerType: 'inline-size' } : undefined}>
                {console.log('[PREVIEW-RUNTIME-1]', JSON.stringify({
    instanceId,
    instanceModuleId: instance?.moduleId,
    resolvedModuleId: mod?.id,
    currentProfileId: currentProfileId,
    effectiveConfig: {
      textColor: effectiveConfig?.textColor,
      barColor: effectiveConfig?.barColor,
      gradientColor: effectiveConfig?.gradientColor,
      backgroundColor: effectiveConfig?.backgroundColor,
      title: effectiveConfig?.title,
      goalType: effectiveConfig?.goalType
    }
  }, null, 2))}
  <Renderer key={instanceId} config={effectiveConfig} mode="preview" />
              </div>
              {isGoalModule && (
                <button
                  onClick={handleTest}
                  className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                    testing
                      ? 'bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30'
                      : 'bg-primary/20 text-primary-light border border-primary/30 hover:bg-primary/30'
                  }`}
                >
                  <FlaskConical className="w-4 h-4" />
                  {testing ? 'Stop Test' : 'Test'}
                </button>
              )}
              {instance && (
                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-white/40 uppercase tracking-wider">Browser Source URL</span>
                    <button onClick={handleCopyUrl} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-all bg-primary/20 text-primary-light border border-primary/30 hover:bg-primary/30">
                      {copiedUrl ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      {copiedUrl ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                  <code className="text-xs text-white/30 break-all font-mono bg-black/30 px-2 py-1.5 rounded">{browserSourceUrl}</code>
                </div>
              )}
            </motion.div>
          </div>

          <div className="lg:col-span-2">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
              <h2 className="text-sm font-semibold text-white mb-4">Settings</h2>
              {!instance && (
                <p className="text-xs text-white/30 mb-3">This overlay has no saved configuration yet. Settings shown are defaults.</p>
              )}
              <SchemaSettings
                schema={(isGoalModule ? flatSchemaWithActions : flatSchema) as any}
                values={effectiveConfig}
                onChange={handleConfigChange}
              />
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CustomizePage;
