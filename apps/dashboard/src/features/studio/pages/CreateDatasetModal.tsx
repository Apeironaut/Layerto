import { useState } from 'react';
import { errorMessage } from '@layerto/api-client';
import { Button, Chip, Input, Modal, Select, Switch, useNotify, useResource } from '@layerto/ui';
import { api } from '../../../lib/api';
import { parseClasses } from '../lib/format';

/** New training dataset: name, project, classes and whether to keep images after training. */
export function CreateDatasetModal({
  isOpen,
  initialProject,
  projects,
  onClose,
  onCreated,
}: {
  isOpen: boolean;
  initialProject: string;
  projects: { value: string; label: string }[];
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const notify = useNotify();
  const plan = useResource(() => api.studioPlan(), 'studio-plan');
  const [name, setName] = useState('');
  const [project, setProject] = useState(initialProject);
  const [classes, setClasses] = useState('');
  const [keep, setKeep] = useState(false);
  const [busy, setBusy] = useState(false);
  const canKeep = plan.data?.limits.keep_datasets ?? false;
  const list = parseClasses(classes);

  const submit = async () => {
    setBusy(true);
    try {
      const d = await api.studioCreateDataset({ name: name.trim(), project_id: project || null, classes: list, keep });
      onCreated(d.id);
    } catch (err) {
      notify(errorMessage(err, "Couldn't create the dataset."), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="New dataset" size="lg">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <Input label="Name" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} required autoFocus />
        <Select label="Project" value={project} onChange={(e) => setProject(e.target.value)} options={[{ value: '', label: 'No project' }, ...projects]} />
        <label className="block">
          <span className="block text-sm font-medium text-ink mb-1.5">Classes (what to detect)</span>
          <textarea
            className="w-full min-h-20 rounded-control border border-line-strong bg-card px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-focus"
            placeholder="ripe, unripe, rotten"
            value={classes}
            onChange={(e) => setClasses(e.target.value)}
          />
          <span className="mt-1 block text-xs text-muted">Separate with commas or new lines. You can add more later.</span>
        </label>
        {list.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {list.map((c) => <Chip key={c} variant="neutral">{c}</Chip>)}
          </div>
        )}
        <Switch
          checked={keep}
          onChange={setKeep}
          disabled={!canKeep}
          label="Keep dataset after training"
          description={canKeep ? 'Images stay until you delete them.' : 'Needs the Researcher or Lab plan. Without it, images are deleted a few days after training.'}
        />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={busy} disabled={!name.trim() || list.length === 0}>Create dataset</Button>
        </div>
      </form>
    </Modal>
  );
}
