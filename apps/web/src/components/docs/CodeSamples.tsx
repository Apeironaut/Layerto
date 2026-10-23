import { useState } from 'react';
import { Card, CopyButton, SegmentedControl } from '@layerto/ui';
import { PUBLIC_API_URL } from '../../config';

type Lang = 'curl' | 'python' | 'js';

const LANGS = [
  { value: 'curl' as const, label: 'curl' },
  { value: 'python' as const, label: 'Python' },
  { value: 'js' as const, label: 'JavaScript' },
];

/** Builds the request example for one endpoint in each language. */
function sample(lang: Lang, path: string, prompt?: string): string {
  const url = `${PUBLIC_API_URL}${path}`;
  if (lang === 'curl') {
    return [
      `curl -X POST "${url}" \\`,
      `  -H "Authorization: Bearer lt_your_api_key_here" \\`,
      `  -F "image=@sample-turtle.jpg"${prompt ? ' \\' : ''}`,
      ...(prompt ? [`  -F "prompt=${prompt}"`] : []),
    ].join('\n');
  }
  if (lang === 'python') {
    return `import requests

url = "${url}"
headers = {"Authorization": "Bearer lt_your_api_key_here"}

with open("sample-turtle.jpg", "rb") as f:
    files = {"image": ("sample-turtle.jpg", f, "image/jpeg")}${prompt ? `\n    data = {"prompt": "${prompt}"}` : ''}
    response = requests.post(url, headers=headers, files=files${prompt ? ', data=data' : ''})

print("Status:", response.status_code)
print("Result:", response.json())`;
  }
  return `import fs from 'node:fs';

const formData = new FormData();
formData.append('image', new Blob([fs.readFileSync('sample-turtle.jpg')], { type: 'image/jpeg' }), 'sample-turtle.jpg');${
    prompt ? `\nformData.append('prompt', '${prompt}');` : ''
  }

const res = await fetch('${url}', {
  method: 'POST',
  headers: { Authorization: 'Bearer lt_your_api_key_here' },
  body: formData,
});
console.log('Result:', await res.json());`;
}

const EXAMPLES = [
  { title: 'Call a model directly', path: '/v1/vision/turtle-id' },
  { title: 'Let Auto pick the model', path: '/v1/vision/auto', prompt: 'sea turtle' },
];

/** Request examples with a language switch; each block can be copied. */
export function CodeSamples() {
  const [lang, setLang] = useState<Lang>('curl');
  return (
    <Card title="Make your first call" actions={<SegmentedControl label="Code language" segments={LANGS} value={lang} onChange={setLang} />}>
      <div className="space-y-6">
        {EXAMPLES.map((ex) => {
          const code = sample(lang, ex.path, ex.prompt);
          return (
            <div key={ex.path}>
              <div className="flex items-center justify-between gap-3 mb-2">
                <h3 className="text-sm font-semibold">
                  {ex.title} <code className="ml-1 text-xs text-muted">{ex.path}</code>
                </h3>
                <CopyButton text={code} />
              </div>
              <pre className="p-4 rounded-control bg-page border border-line font-mono text-xs text-ink overflow-x-auto" tabIndex={0}>
                {code}
              </pre>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
