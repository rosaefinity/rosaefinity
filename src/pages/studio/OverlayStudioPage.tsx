import React, { useCallback, memo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { cn } from '../../lib/utils';
import { useOverlayStore } from '../../lib/overlay-store';
import { getOverlayModule } from '../../overlays/registry';
import { OverlayListPanel } from './OverlayListPanel';
import { PreviewCanvas } from './PreviewCanvas';
import { PropertiesPanel } from './PropertiesPanel';

interface OverlayStudioPageProps {
  className?: string;
}

function OverlayStudioPageInner({ className }: OverlayStudioPageProps): React.ReactElement {
  const { instanceId } = useParams<{ instanceId: string }>();
  const navigate = useNavigate();

  const instance = useOverlayStore((s) =>
    s.instances.find((i) => i.id === instanceId),
  );
  const updateConfig = useOverlayStore((s) => s.updateConfig);

  const mod = instance ? getOverlayModule(instance.moduleId) : undefined;

  const handleConfigChange = useCallback(
    (patch: Record<string, unknown>) => {
      if (!instance) return;
      updateConfig(instance.id, { ...instance.config, ...patch });
    },
    [instance, updateConfig],
  );

  const handleSelectOverlay = useCallback(
    (id: string) => {
      navigate(`/studio/${id}`);
    },
    [navigate],
  );

  const handleBack = useCallback(() => {
    navigate('/overlays');
  }, [navigate]);

  return (
    <div className={cn('flex h-full bg-[#0a0a0f] overflow-hidden', className)}>
      {/* Left: Overlay List */}
      <OverlayListPanel
        selectedId={instanceId ?? null}
        onSelect={handleSelectOverlay}
        onBack={handleBack}
        className="w-[20%] min-w-[200px] max-w-[280px] shrink-0"
      />

      {/* Center: Preview Canvas */}
      <PreviewCanvas
        instance={instance}
        module={mod}
        className="flex-1 min-w-0"
      />

      {/* Right: Properties Panel */}
      <PropertiesPanel
        instance={instance}
        module={mod}
        onConfigChange={handleConfigChange}
        className="w-[25%] min-w-[260px] max-w-[340px] shrink-0"
      />
    </div>
  );
}

export const OverlayStudioPage = memo(OverlayStudioPageInner);
OverlayStudioPage.displayName = 'OverlayStudioPage';
export default OverlayStudioPage;
