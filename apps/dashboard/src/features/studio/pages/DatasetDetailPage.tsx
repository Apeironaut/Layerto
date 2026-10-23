import { useEffect, useState } from 'react';
import { errorMessage } from '@layerto/api-client';
import {
  Button,
  Card,
  Chip,
  ConfirmModal,
  EmptyState,
  PageHeader,
  ProgressBar,
  Reveal,
  SegmentedControl,
  Select,
  Skeleton,
  StatCard,
  Switch,
  useNotify,
  useResource,
} from '@layerto/ui';
import { api } from '../../../lib/api';
import { AuthImage } from '../components/AuthImage';
import { MultiUpload } from '../components/MultiUpload';
import { RetentionNote } from '../components/RetentionNote';
import { bytes, classColor, parseClasses } from '../lib/format';

const PAGE = 60;
const BATCH = 20;

export function DatasetDetailPage({ id, navigate }: { id: string; navigate: (to: string) => void }) {
  const notify = useNotify();
  const ds = useResource(() => api.studioDataset(id), `studio-ds-${id}`);
  const plan = useResource(() => api.studioPlan(), 'studio-plan');
  const projects = useResource(() => api.studioProjects(), 'studio-projects');
  const [filter, setFilter] = useState<'all' | 'labeled' | 'unlabeled'>('all');
  const [page, setPage] = useState(0);
  const images = useResource(() => api.studioImages(id, { offset: page * PAGE, limit: PAGE, filter }), `studio-imgs-${id}-${filter}-${page}`);
  const [upload, setUpload] = useState<{ done: number; total: number; failed: string[] } | null>(null);
  const [classText, setClassText] = useState('');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (ds.data) setClassText(ds.data.classes.join(', '));
  }, [ds.data]);

  if (ds.error) return <EmptyState icon="database" title="Dataset not found" action={<Button onClick={() => navigate('/projects')}>Projects</Button>} />;
  const d = ds.data;
  if (!d) return <Skeleton className="h-64" />;
  const backTo = d.kind === 'bundle' ? '/sell' : d.project_id ? `/projects/${d.project_id}/data` : '/projects';
  const backLabel = d.kind === 'bundle' ? '← Sell' : d.project_id ? '← Project' : '← Projects';
  const purged = d.purged_at !== null;

  const patch = async (p: Parameters<typeof api.studioUpdateDataset>[1], msg: string) => {
    try {
      await api.studioUpdateDataset(id, p);
      notify(msg, 'success');
      await ds.reload();
    } catch (err) {
      notify(errorMessage(err, "Couldn't save the dataset."), 'error');
      await ds.reload();
    }
  };

  const uploadFiles = async (files: File[]) => {
    const failed: string[] = [];
    setUpload({ done: 0, total: files.length, failed });
    for (let i = 0; i < files.length; i += BATCH) {
      const chunk = files.slice(i, i + BATCH);
      try {
        const res = await api.studioUploadImages(id, chunk);
        for (const r of res.results) if (r.error) failed.push(`${r.file_name}: ${r.error}`);
      } catch (err) {
        failed.push(errorMessage(err, 'Upload failed'));
        break;
      }
      setUpload({ done: Math.min(files.length, i + BATCH), total: files.length, failed: [...failed] });
    }
    setUpload(null);
    const ok = files.length - failed.length;
    if (failed.length) notify(`${ok} added, ${failed.length} skipped. ${failed[0]}`, 'error');
    else notify(`${ok} images added`, 'success');
    await Promise.all([ds.reload(), images.reload()]);
  };

  const remove = async () => {
    try {
      await api.studioDeleteDataset(id);
      notify('Dataset deleted', 'success');
      navigate(backTo);
    } catch (err) {
      notify(errorMessage(err, "Couldn't delete the dataset."), 'error');
    }
  };

  const canKeep = plan.data?.limits.keep_datasets ?? false;
  const list = images.data ?? [];

  return (
    <>
      <PageHeader
        title={d.name}
        description={<button type="button" className="text-crimson cursor-pointer" onClick={() => navigate(backTo)}>{backLabel}</button>}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" icon="pen" disabled={purged || d.images === 0} onClick={() => navigate(`/datasets/${id}/annotate`)}>Annotate</Button>
            {d.kind !== 'bundle' && <Button icon="cpu" disabled={purged || d.labeled === 0} onClick={() => navigate(d.project_id ? `/projects/${d.project_id}/train?dataset=${id}` : `/projects`)}>Train</Button>}
            <Button variant="ghost" icon="trash" onClick={() => setDeleting(true)}>Delete</Button>
          </div>
        }
      />
      <Reveal index={0}>
        <div className="space-y-4">
          {d.kind !== 'bundle' && <RetentionNote d={d} />}
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
            <StatCard label="Images" value={d.images} />
            <StatCard label="Labeled" value={`${d.labeled}`} hint={d.images ? `${Math.round((d.labeled / d.images) * 100)}% done` : undefined} />
            <StatCard label="Boxes" value={d.boxes} />
            <StatCard label="Size" value={bytes(d.bytes)} />
          </div>
        </div>
      </Reveal>
      {!purged && (
        <Reveal index={1}>
          <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            <Card title="Add images">
              {upload ? (
                <div className="space-y-2 py-6">
                  <p className="text-sm text-ink">Uploading {upload.done} of {upload.total}…</p>
                  <ProgressBar label={`Uploading ${upload.done} of ${upload.total}`} current={upload.done} max={upload.total} />
                  <p className="text-xs text-muted">Images are encrypted before they are written to disk.</p>
                </div>
              ) : (
                <MultiUpload onFiles={uploadFiles} />
              )}
            </Card>
            <Card title="Settings">
              <div className="space-y-4">
                <label className="block">
                  <span className="block text-sm font-medium text-ink mb-1.5">Classes</span>
                  <textarea
                    className="w-full min-h-16 rounded-control border border-line-strong bg-card px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-focus"
                    value={classText}
                    onChange={(e) => setClassText(e.target.value)}
                  />
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {d.classes.map((c, i) => (
                    <span key={c} className="inline-flex items-center gap-1.5 text-xs text-ink-secondary">
                      <span className="size-2.5 rounded-full" style={{ background: classColor(i) }} />
                      {c}
                    </span>
                  ))}
                </div>
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={parseClasses(classText).join('|') === d.classes.join('|')}
                    onClick={() => patch({ classes: parseClasses(classText) }, 'Classes saved')}
                  >
                    Save classes
                  </Button>
                </div>
                {d.kind === 'bundle' ? (
                  <p className="text-xs text-muted">
                    A photo collection for sale. Set the title, license and price from{' '}
                    <button type="button" className="text-crimson cursor-pointer" onClick={() => navigate('/sell')}>
                      Sell
                    </button>
                    . Buyers see up to 8 small previews before they pay.
                  </p>
                ) : (
                  <>
                    <Select
                      label="Project"
                      value={d.project_id ?? ''}
                      onChange={(e) => patch({ project_id: e.target.value }, 'Moved')}
                      options={[{ value: '', label: 'No project' }, ...(projects.data ?? []).map((p) => ({ value: p.id, label: p.name }))]}
                    />
                    <Switch
                      checked={d.keep}
                      disabled={!canKeep && !d.keep}
                      onChange={(v) => patch({ keep: v }, v ? 'Dataset will be kept' : 'Dataset will be deleted after training')}
                      label="Keep dataset after training"
                      description={canKeep ? 'Off: images are deleted a few days after a successful training run.' : 'Your plan deletes images a few days after training; pick a plan that keeps datasets to change this.'}
                    />
                  </>
                )}
              </div>
            </Card>
          </div>
        </Reveal>
      )}
      {!purged && (
        <Reveal index={2}>
          <Card
            title="Images"
            actions={
              <SegmentedControl
                label="Show"
                value={filter}
                onChange={(v) => {
                  setFilter(v);
                  setPage(0);
                }}
                segments={[
                  { value: 'all', label: 'All' },
                  { value: 'unlabeled', label: 'To do' },
                  { value: 'labeled', label: 'Labeled' },
                ]}
              />
            }
          >
            {images.loading ? (
              <Skeleton className="h-40" />
            ) : list.length === 0 ? (
              <p className="text-sm text-muted py-6 text-center">No images here.</p>
            ) : (
              <>
                <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2">
                  {list.map((im, i) => (
                    <button
                      key={im.id}
                      type="button"
                      onClick={() => navigate(`/datasets/${id}/annotate?i=${page * PAGE + i}&f=${filter}`)}
                      className="group relative aspect-square overflow-hidden rounded-control border border-line bg-page cursor-pointer"
                      title={im.file_name}
                    >
                      <AuthImage path={api.studioImagePath(id, im.id)} alt={im.file_name} className="h-full w-full object-cover group-hover:scale-105 transition-transform" />
                      <span className="absolute bottom-1 left-1">
                        {im.labeled ? <Chip variant="active">{im.boxes.length}</Chip> : <Chip variant="muted">to do</Chip>}
                      </span>
                    </button>
                  ))}
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <Button size="sm" variant="secondary" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</Button>
                  <span className="text-xs text-muted">Page {page + 1}</span>
                  <Button size="sm" variant="secondary" disabled={list.length < PAGE} onClick={() => setPage(page + 1)}>Next</Button>
                </div>
              </>
            )}
          </Card>
        </Reveal>
      )}
      <ConfirmModal
        isOpen={deleting}
        title="Delete this dataset?"
        description="All its images and boxes are deleted now. Models already trained from it keep working."
        confirmLabel="Delete dataset"
        danger
        onConfirm={remove}
        onCancel={() => setDeleting(false)}
      />
    </>
  );
}
