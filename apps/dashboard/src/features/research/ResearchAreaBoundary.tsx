import { createContext, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { ResearchArea, WorkspaceViewMode } from '@layerto/types';
import { api } from '../../lib/api';
import type { LayertoClient } from '@layerto/api-client';

export interface AreaVaultContextValue {
  areaId: string;
  area: ResearchArea;
  scopedClient: LayertoClient;
  viewMode: WorkspaceViewMode;
  setViewMode: (mode: WorkspaceViewMode) => void;
  isScopedCollaborator: boolean;
  setIsScopedCollaborator: (scoped: boolean) => void;
  reloadArea: () => Promise<void>;
  updateAreaLocally: (patch: Partial<ResearchArea>) => void;
}

const AreaVaultContext = createContext<AreaVaultContextValue | null>(null);

export function useAreaVault(): AreaVaultContextValue {
  const ctx = useContext(AreaVaultContext);
  if (!ctx) {
    throw new Error('useAreaVault must be used within a ResearchAreaBoundary');
  }
  return ctx;
}

interface ResearchAreaBoundaryProps {
  areaId: string;
  initialArea: ResearchArea;
  children: ReactNode;
}

/**
 * Hard-isolated Research Area Boundary.
 * When areaId changes, the parent MUST supply key={areaId} to guarantee
 * a complete React tree unmount and state reset with zero cross-area state leaking.
 */
export function ResearchAreaBoundary({
  areaId,
  initialArea,
  children,
}: ResearchAreaBoundaryProps) {
  const [area, setArea] = useState<ResearchArea>(initialArea);
  const [viewMode, setViewMode] = useState<WorkspaceViewMode>('domain');
  const [isScopedCollaborator, setIsScopedCollaborator] = useState<boolean>(false);

  // Strictly air-gapped API client scoped with X-Research-Area-ID
  const scopedClient = useMemo(() => api.areaScoped(areaId), [areaId]);

  const reloadArea = async () => {
    try {
      const fresh = await scopedClient.area(areaId);
      setArea(fresh);
    } catch (err) {
      console.error('Failed to reload isolated research area', err);
    }
  };

  const updateAreaLocally = (patch: Partial<ResearchArea>) => {
    setArea((prev) => ({ ...prev, ...patch }));
  };

  const value = useMemo<AreaVaultContextValue>(
    () => ({
      areaId,
      area,
      scopedClient,
      viewMode,
      setViewMode,
      isScopedCollaborator,
      setIsScopedCollaborator,
      reloadArea,
      updateAreaLocally,
    }),
    [areaId, area, scopedClient, viewMode, isScopedCollaborator],
  );

  return (
    <AreaVaultContext.Provider value={value}>
      <div data-research-vault={areaId} data-view-mode={viewMode} className="w-full">
        {children}
      </div>
    </AreaVaultContext.Provider>
  );
}
