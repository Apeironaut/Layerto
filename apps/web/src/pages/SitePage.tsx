import { useEffect, useState } from 'react';
import type { PublicSite } from '@layerto/types';
import { ModelSiteView, Skeleton } from '@layerto/ui';
import { useSeo } from '../hooks/useSeo';
import { studioClient } from '../lib/studio';

/** A model's website at /s/<slug>. Runs go through the server-side proxy, billed to the site owner. */
export function SitePage({ slug }: { slug: string }) {
  const [site, setSite] = useState<PublicSite | null>(null);
  const [missing, setMissing] = useState(false);
  useEffect(() => {
    let alive = true;
    studioClient.publicSite(slug).then(
      (s) => alive && setSite(s),
      () => alive && setMissing(true),
    );
    return () => {
      alive = false;
    };
  }, [slug]);
  useSeo(site ? site.title : 'Layerto', site?.tagline || 'A computer vision model on Layerto.');

  if (missing) {
    return (
      <div className="min-h-screen grid place-items-center bg-page text-ink px-4 text-center">
        <div>
          <h1 className="text-2xl font-bold">This site isn't available</h1>
          <p className="mt-2 text-muted">It may have been unpublished, or the address may have a typo.</p>
          <a href="/" className="mt-6 inline-block text-crimson">Layerto</a>
        </div>
      </div>
    );
  }
  if (!site) return <div className="p-8"><Skeleton className="h-[70vh]" /></div>;
  return <ModelSiteView site={site} onRun={async (file) => (await studioClient.runSite(slug, file)).predictions} />;
}
