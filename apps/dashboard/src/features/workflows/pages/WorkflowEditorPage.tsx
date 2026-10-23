import { useCallback, useEffect, useRef, useState } from 'react';
import type { OutputConfig } from '@layerto/types';
import { Alert, Button, ConfirmModal, EmptyState, Icon, Skeleton, useNotify } from '@layerto/ui';
import { useModels } from '../../../hooks/useModels';
import { useWorkflowEditor } from '../hooks/useWorkflowEditor';
import { useFavorites } from '../hooks/useFavorites';
import { useEditorShortcuts } from '../hooks/useEditorShortcuts';
import { costPerImage, formatRange } from '../lib/cost';
import { EditorToolbar } from '../components/EditorToolbar';
import { StepPalette } from '../components/canvas/StepPalette';
import { WorkflowCanvas } from '../components/canvas/WorkflowCanvas';
import type { CanvasHandle } from '../components/canvas/WorkflowCanvas';
import { InspectorPanel } from '../components/inspector/InspectorPanel';
import { RunPanel } from '../components/run/RunPanel';
import { ApiSnippet } from '../components/ApiSnippet';
import { ShortcutsModal } from '../components/ShortcutsModal';

export interface WorkflowEditorPageProps {
  workflowId?: string;
  templateId?: string;
  navigate: (path: string) => void;
  onCharged: () => void;
}

export function WorkflowEditorPage({ workflowId, templateId, navigate, onCharged }: WorkflowEditorPageProps) {
  const notify = useNotify();
  const models = useModels();
  const editor = useWorkflowEditor(workflowId, models.data, templateId);
  const fav = useFavorites();
  const canvas = useRef<CanvasHandle>(null);
  const [leaving, setLeaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [runOpen, setRunOpen] = useState(false);
  const [apiOpen, setApiOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [running, setRunning] = useState(false);
  // On narrower screens the canvas gets the space; the palette is one click away.
  const [paletteOpen, setPaletteOpen] = useState(() => window.innerWidth >= 1600);

  // Warn before closing the tab with unsaved work.
  useEffect(() => {
    if (!editor.dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [editor.dirty]);

  const save = useCallback(async () => {
    const saved = await editor.save();
    if (!saved) return;
    notify('Workflow saved', 'success');
    if (!workflowId) navigate(`/workflows/${saved.id}`);
  }, [editor, notify, workflowId, navigate]);

  const focusNode = useCallback((id: string) => editor.select(id), [editor]);

  useEditorShortcuts({
    save: () => void save(),
    undo: editor.undo,
    redo: editor.redo,
    deleteSelection: editor.removeSelected,
    duplicate: () => editor.selectedNode && editor.duplicate(editor.selectedNode.id),
    openAddStep: () => canvas.current?.openAddMenu(),
    tidy: editor.tidy,
    fitView: () => canvas.current?.fitView(),
    showHelp: () => setHelpOpen(true),
    escape: () => {
      canvas.current?.closeMenus();
      editor.select(null);
    },
  });

  if (editor.loadError) {
    return (
      <div className="p-8">
        <EmptyState icon="alert" title="Couldn't open this workflow" description={editor.loadError} action={<Button onClick={() => navigate('/workflows')}>Back to workflows</Button>} />
      </div>
    );
  }

  if (!editor.ready || !editor.definition) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-12" />
        <Skeleton className="h-[60svh]" />
      </div>
    );
  }

  const definition = editor.definition;
  const output = definition.nodes.find((n) => n.type === 'output')?.config as OutputConfig;
  const canRun = !!editor.id && !editor.dirty && editor.issues.count === 0;

  return (
    <>
      <div className="lg:hidden p-6">
        <EmptyState
          icon="monitor"
          title="Open the editor on a larger screen"
          description="The workflow canvas needs at least 1024 px of width. You can still run and manage workflows from the list."
          action={<Button onClick={() => navigate('/workflows')}>Back to workflows</Button>}
        />
      </div>

      <div className="hidden lg:flex flex-col h-svh min-h-0 bg-page">
        <EditorToolbar
          name={editor.name}
          onName={editor.setName}
          dirty={editor.dirty}
          saving={editor.saving}
          saved={!!editor.id}
          issueCount={editor.issues.count}
          costLabel={formatRange(costPerImage(definition, models.data ?? []))}
          canRun={canRun}
          onBack={() => (editor.dirty ? setLeaving(true) : navigate('/workflows'))}
          onShowIssues={() => editor.select(null)}
          onSave={() => void save()}
          onRun={() => setRunOpen(true)}
          onApi={() => setApiOpen(true)}
          onDelete={editor.id ? () => setDeleting(true) : undefined}
        />
        {editor.saveError && (
          <div className="px-4 pt-3">
            <Alert tone="error">
              <span className="flex items-center justify-between gap-3">
                {editor.saveError}
                <button type="button" onClick={editor.clearSaveError} className="text-xs font-semibold underline cursor-pointer">
                  Dismiss
                </button>
              </span>
            </Alert>
          </div>
        )}
        <div className="flex flex-1 min-h-0">
          {!paletteOpen && (
            <div className="w-12 shrink-0 border-r border-line bg-card flex flex-col items-center py-3">
              <button type="button" onClick={() => setPaletteOpen(true)} aria-label="Show the steps panel" title="Show steps" className="p-2 rounded-control text-ink-secondary hover:bg-crimson-tint hover:text-crimson cursor-pointer">
                <Icon name="layers" size={18} />
              </button>
            </div>
          )}
          {paletteOpen && <StepPalette
            onCollapse={() => setPaletteOpen(false)}
            models={models.data}
            favorites={fav.favorites}
            recent={fav.recent}
            onToggleFavorite={fav.toggle}
            onAdd={(type, slug) => {
              const sel = editor.selectedNode;
              const from = sel && sel.type !== 'output' ? { nodeId: sel.id, handle: sel.type === 'condition' ? 'yes' : null } : undefined;
              editor.addStep(type, { slug, from });
              if (slug) fav.markUsed(slug);
            }}
          />}
          <WorkflowCanvas
            handle={canvas}
            editor={editor}
            models={models.data}
            favorites={fav.favorites}
            recent={fav.recent}
            onToggleFavorite={fav.toggle}
            onModelUsed={fav.markUsed}
            onProblem={(m) => notify(m, 'error')}
            onShowHelp={() => setHelpOpen(true)}
            running={running}
          />
          <InspectorPanel
            node={editor.selectedNode}
            definition={definition}
            models={models.data ?? []}
            favorites={fav.favorites}
            recent={fav.recent}
            onToggleFavorite={fav.toggle}
            onModelUsed={fav.markUsed}
            issues={editor.issues}
            name={editor.name}
            description={editor.description}
            onName={editor.setName}
            onDescription={editor.setDescription}
            onChange={editor.updateConfig}
            onDuplicate={editor.duplicate}
            onDelete={(id) => editor.removeNodes([id])}
            onClose={() => editor.select(null)}
            onFocus={focusNode}
          />
        </div>
      </div>

      {editor.id && (
        <>
          <RunPanel
            isOpen={runOpen}
            onClose={() => setRunOpen(false)}
            workflowId={editor.id}
            definition={definition}
            models={models.data ?? []}
            onRunningChange={setRunning}
            onCharged={onCharged}
          />
          <ApiSnippet isOpen={apiOpen} onClose={() => setApiOpen(false)} workflowId={editor.id} csv={output.format === 'csv'} />
        </>
      )}
      <ShortcutsModal isOpen={helpOpen} onClose={() => setHelpOpen(false)} />
      <ConfirmModal
        isOpen={leaving}
        title="Leave without saving?"
        description="Your changes to this workflow will be lost."
        confirmLabel="Leave"
        danger
        onConfirm={() => navigate('/workflows')}
        onCancel={() => setLeaving(false)}
      />
      <ConfirmModal
        isOpen={deleting}
        title="Delete this workflow?"
        description={`“${editor.name}” will stop working for any app that calls it. This can't be undone.`}
        confirmLabel="Delete workflow"
        danger
        onConfirm={async () => {
          if (await editor.deleteWorkflow()) {
            notify('Workflow deleted', 'success');
            navigate('/workflows');
          }
          setDeleting(false);
        }}
        onCancel={() => setDeleting(false)}
      />
    </>
  );
}
