import { useEffect, useState } from 'react';
import { imageReady, settleWithin, useBootMilestones, windowLoaded } from '@layerto/ui';
import { loadModels } from '../lib/models';

/**
 * Real loading milestones for the public site: logo decoded → model list fetched
 * (or failed / 4s timeout, so a slow API never blocks the page) → page assets loaded.
 */
export function useSiteBoot() {
  const [logo, setLogo] = useState(false);
  const [models, setModels] = useState(false);
  const [assets, setAssets] = useState(false);

  useEffect(() => {
    imageReady('/brand/layerto-symbol.png').then(() => setLogo(true));
    settleWithin(loadModels(), 4000).then(() => setModels(true));
    settleWithin(windowLoaded(), 6000).then(() => setAssets(true));
  }, []);

  useBootMilestones([
    { label: 'Preparing the logo', done: logo },
    { label: 'Fetching models', done: models },
    { label: 'Loading images', done: assets },
  ]);
}
