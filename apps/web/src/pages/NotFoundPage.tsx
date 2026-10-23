import { Button } from '@layerto/ui';
import { useSeo } from '../hooks/useSeo';

export function NotFoundPage({ navigate }: { navigate: (to: string) => void }) {
  useSeo('Page not found — Layerto', 'This page does not exist.');
  return (
    <div className="max-w-xl mx-auto px-4 py-24 text-center">
      <p className="text-6xl font-bold text-crimson">404</p>
      <h1 className="mt-4 text-2xl font-bold">This page doesn't exist</h1>
      <p className="mt-2 text-muted">The link may be old, or the address may have a typo.</p>
      <Button className="mt-6" onClick={() => navigate('/')}>
        Go to the home page
      </Button>
    </div>
  );
}
