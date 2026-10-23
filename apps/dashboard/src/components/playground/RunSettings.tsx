import { Input, Select } from '@layerto/ui';
import type { SelectOption } from '@layerto/ui';

export interface RunSettingsProps {
  modelOptions: SelectOption[];
  model: string;
  onModel: (slug: string) => void;
  prompt: string;
  onPrompt: (prompt: string) => void;
}

/** Which model to run and the optional routing prompt. */
export function RunSettings({ modelOptions, model, onModel, prompt, onPrompt }: RunSettingsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <Select label="Model" options={modelOptions} value={model} onChange={(e) => onModel(e.target.value)} />
      <Input
        label="Prompt (optional)"
        placeholder="e.g. sea turtle, කැස්බෑවා"
        maxLength={1000}
        helperText={model === 'auto' ? 'Auto uses the prompt to pick a model.' : 'Used for routing with Auto only.'}
        value={prompt}
        onChange={(e) => onPrompt(e.target.value)}
      />
    </div>
  );
}
