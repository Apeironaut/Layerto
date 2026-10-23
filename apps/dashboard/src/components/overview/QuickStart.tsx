import { Button, Card, CopyButton } from '@layerto/ui';
import { PUBLIC_API_URL } from '../../config';

/** The shortest path to a first API call. */
export function QuickStart({ onCreateKey, onOpenPlayground }: { onCreateKey: () => void; onOpenPlayground: () => void }) {
  const curl = `curl -X POST "${PUBLIC_API_URL}/v1/vision/auto" \\\n  -H "Authorization: Bearer $LAYERTO_KEY" \\\n  -F "image=@photo.jpg" -F "prompt=sea turtle"`;
  return (
    <Card title="Make your first call" subtitle="Create a key, then send an image from your terminal." actions={<CopyButton text={curl} />}>
      <pre className="p-4 rounded-control bg-page border border-line font-mono text-xs overflow-x-auto" tabIndex={0}>
        {curl}
      </pre>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button size="sm" icon="key" onClick={onCreateKey}>
          Create a key
        </Button>
        <Button size="sm" variant="secondary" icon="spark" onClick={onOpenPlayground}>
          Try it in the playground
        </Button>
      </div>
    </Card>
  );
}
