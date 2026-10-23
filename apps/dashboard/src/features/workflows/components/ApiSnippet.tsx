import { useState } from 'react';
import { CopyButton, Modal, SegmentedControl } from '@layerto/ui';
import { PUBLIC_API_URL } from '../../../config';

type Lang = 'curl' | 'js' | 'python';

function snippets(id: string, csv: boolean): Record<Lang, string> {
  const url = `${PUBLIC_API_URL}/v1/workflows/${id}/run`;
  return {
    curl: `curl -X POST "${url}" \\
  -H "Authorization: Bearer $LAYERTO_KEY" \\
  -F images=@photo-1.jpg \\
  -F images=@photo-2.jpg${csv ? ' \\\n  -o results.csv' : ''}`,
    js: `const form = new FormData();
for (const file of files) form.append('images', file);

const res = await fetch('${url}', {
  method: 'POST',
  headers: { Authorization: \`Bearer \${process.env.LAYERTO_KEY}\` },
  body: form,
});
if (!res.ok) throw new Error((await res.json()).error.message);
const result = ${csv ? 'await res.text(); // CSV' : 'await res.json();'}`,
    python: `import os, requests

files = [("images", open(p, "rb")) for p in ["photo-1.jpg", "photo-2.jpg"]]
res = requests.post(
    "${url}",
    headers={"Authorization": f"Bearer {os.environ['LAYERTO_KEY']}"},
    files=files,
    timeout=150,
)
res.raise_for_status()
result = ${csv ? 'res.text  # CSV' : 'res.json()'}`,
  };
}

/** How to call this workflow from code. */
export function ApiSnippet({ isOpen, onClose, workflowId, csv }: { isOpen: boolean; onClose: () => void; workflowId: string; csv: boolean }) {
  const [lang, setLang] = useState<Lang>('curl');
  const code = snippets(workflowId, csv)[lang];
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Call this workflow" description="Send images as multipart form data with an API key. Each model call is billed; failed calls are free." size="lg">
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <SegmentedControl
            label="Language"
            segments={[
              { value: 'curl', label: 'curl' },
              { value: 'js', label: 'JavaScript' },
              { value: 'python', label: 'Python' },
            ]}
            value={lang}
            onChange={setLang}
          />
          <CopyButton text={code} />
        </div>
        <pre className="overflow-x-auto rounded-l2 bg-[#15161A] text-[#ECEDEF] p-4 font-mono text-xs leading-relaxed" tabIndex={0}>
          {code}
        </pre>
        <p className="text-xs text-muted">
          Workflow ID: <code className="font-mono">{workflowId}</code>. Create a key under API keys and keep it secret.
        </p>
      </div>
    </Modal>
  );
}
