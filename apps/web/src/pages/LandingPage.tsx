import { ScrollProgress } from '../components/layout/ScrollProgress';
import { SceneHero } from '../scenes/SceneHero';
import { SceneWhatWeDo } from '../scenes/SceneWhatWeDo';
import { SceneProducts } from '../scenes/SceneProducts';
import { SceneHowItWorks } from '../scenes/SceneHowItWorks';
import { SceneStudio } from '../scenes/SceneStudio';
import { SceneHub } from '../scenes/SceneHub';
import { ScenePricing } from '../scenes/ScenePricing';
import { SceneAbout } from '../scenes/SceneAbout';
import { SceneFaq } from '../scenes/SceneFaq';
import { SceneCta } from '../scenes/SceneCta';
import { useSeo } from '../hooks/useSeo';
import type { ModelsState } from '../hooks/useModels';

export interface LandingPageProps {
  navigate: (to: string) => void;
  models: ModelsState;
}

/** The scroll-driven landing page: full-viewport scenes, edge to edge. */
export function LandingPage({ navigate, models }: LandingPageProps) {
  useSeo(
    'Layerto — The layer between AI and the real world',
    'Layerto sits between your software and AI: Layerto Vision for specialist image models, a hub where researchers, photographers, builders and teams train, publish and trade models and data, Charon for AI agents you can trust. Every call checked and recorded.',
  );
  return (
    <div className="w-full overflow-x-clip">
      <ScrollProgress />
      <SceneHero onNavigate={navigate} />
      <SceneWhatWeDo />
      <SceneProducts onNavigate={navigate} models={models} />
      <SceneHowItWorks />
      <SceneHub />
      <SceneStudio />
      <ScenePricing models={models} navigate={navigate} />
      <SceneAbout />
      <SceneFaq />
      <SceneCta onNavigate={navigate} />
    </div>
  );
}
