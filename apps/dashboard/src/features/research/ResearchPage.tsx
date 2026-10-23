import { Skeleton, useResource } from '@layerto/ui';
import { api } from '../../lib/api';
import { MainResearchHub } from './MainResearchHub';
import { AreaWorkspace } from './AreaWorkspace';
import { ResearchAreaBoundary } from './ResearchAreaBoundary';
import type { ResearchArea } from '@layerto/types';

interface ResearchPageProps {
  areaId?: string;
  tab?: string;
}

/**
 * Top-level Research Section Router:
 * - Level 1: Main Research Hub (`/research`) — Shared compute/storage pool, isolated area gallery, and area creator.
 * - Level 2: Scoped Research Area (`/research/area/:areaId`) — Mounted inside an air-gapped ResearchAreaBoundary (key={areaId}) with state reset.
 */
export function ResearchPage({ areaId, tab }: ResearchPageProps) {
  // If an areaId is present, fetch the area to initialize the boundary
  const areaResource = useResource<ResearchArea | null>(
    () => (areaId ? api.area(areaId) : Promise.resolve(null)),
    `area-${areaId || 'none'}`,
  );

  const area = areaResource.data;

  // Level 1: No area selected -> Show main research hub with shared quotas and area cards
  if (!areaId) {
    return <MainResearchHub />;
  }

  // Loading state when transitioning into an isolated area
  if (areaResource.loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-44 rounded-l3 w-full" />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Skeleton className="h-24 rounded-l2" />
          <Skeleton className="h-24 rounded-l2" />
          <Skeleton className="h-24 rounded-l2" />
          <Skeleton className="h-24 rounded-l2" />
        </div>
      </div>
    );
  }

  // If area was not found, fallback to main research hub
  if (!area) {
    return <MainResearchHub />;
  }

  // Level 2: Render inside air-gapped boundary with key={areaId} guaranteeing zero state pass-through
  return (
    <ResearchAreaBoundary key={area.id} areaId={area.id} initialArea={area}>
      <AreaWorkspace initialTab={tab} />
    </ResearchAreaBoundary>
  );
}
