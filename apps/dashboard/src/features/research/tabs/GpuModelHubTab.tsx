import { useState } from 'react';
import { Button, Icon } from '@layerto/ui';
import type { OptionalModuleId, ResearchArea } from '@layerto/types';
import { useAreaVault } from '../ResearchAreaBoundary';

interface GpuTier {
  id: string;
  name: string;
  vram: string;
  costPerHourCredits: number;
  description: string;
  status: 'available' | 'provisioned' | 'busy';
  architecture: string;
}

const GPU_TIERS: GpuTier[] = [
  {
    id: 't4',
    name: 'NVIDIA T4 Tensor Core',
    vram: '16 GB GDDR6',
    costPerHourCredits: 10,
    description: 'Cost-effective inference, lightweight fine-tuning, and computer vision feature extraction.',
    status: 'available',
    architecture: 'Turing',
  },
  {
    id: 'l4',
    name: 'NVIDIA L4 Universal GPU',
    vram: '24 GB GDDR6',
    costPerHourCredits: 25,
    description: 'High efficiency for mid-size vision transformers, video analytics, and audio transcription.',
    status: 'available',
    architecture: 'Ada Lovelace',
  },
  {
    id: 'rtx4090',
    name: 'NVIDIA RTX 4090 Enterprise',
    vram: '24 GB G6X (828 GB/s)',
    costPerHourCredits: 35,
    description: 'Ultra-fast tensor kernels optimized for rapid local PyTorch prototyping and diffusion models.',
    status: 'provisioned',
    architecture: 'Ada Lovelace',
  },
  {
    id: 'a100',
    name: 'NVIDIA A100 Tensor Core',
    vram: '80 GB HBM2e (2 TB/s)',
    costPerHourCredits: 75,
    description: 'Heavyweight transformer pre-training, multilingual tokenizers, and high-throughput LLM fine-tuning.',
    status: 'available',
    architecture: 'Ampere',
  },
];

interface ModelCheckpoint {
  id: string;
  name: string;
  framework: string;
  architecture: string;
  datasetSplit: string;
  loss: number;
  metricLabel: string;
  metricValue: string;
  epochs: number;
  sizeBytes: string;
  updatedAt: string;
}

const SEED_CHECKPOINTS: ModelCheckpoint[] = [
  {
    id: 'chk-1',
    name: 'ByT5-Paleo-Epigraphy-v2.safetensors',
    framework: 'PyTorch / HuggingFace',
    architecture: 'ByT5 Byte-Fallback Transformer',
    datasetSplit: 'v1.1.0-palm-leaf-verified',
    loss: 0.084,
    metricLabel: 'CER',
    metricValue: '1.42%',
    epochs: 35,
    sizeBytes: '592 MB',
    updatedAt: '2026-10-23',
  },
  {
    id: 'chk-2',
    name: 'TrOCR-Sinhala-PalmLeaf-Checkpoint-84000',
    framework: 'PyTorch / Transformers',
    architecture: 'Vision Encoder-Decoder (DeBERTa+BEiT)',
    datasetSplit: 'v1.0.0-epigraphy-macro',
    loss: 0.128,
    metricLabel: 'Token Acc',
    metricValue: '96.8%',
    epochs: 28,
    sizeBytes: '1.42 GB',
    updatedAt: '2026-10-22',
  },
];

export function GpuModelHubTab() {
  const { area, scopedClient, updateAreaLocally } = useAreaVault();
  const [checkpoints, setCheckpoints] = useState<ModelCheckpoint[]>(SEED_CHECKPOINTS);
  const [activeTier, setActiveTier] = useState<string>('rtx4090');
  const [isProvisioning, setIsProvisioning] = useState<string | null>(null);

  // Checkpoint registration modal
  const [isAddCheckpointOpen, setIsAddCheckpointOpen] = useState(false);
  const [deletingCheckpointId, setDeletingCheckpointId] = useState<string | null>(null);
  const [uninstallConfirm, setUninstallConfirm] = useState(false);

  const [formName, setFormName] = useState('');
  const [formArch, setFormArch] = useState('');
  const [formLoss, setFormLoss] = useState('0.095');
  const [formMetricLabel, setFormMetricLabel] = useState('F1 / Acc');
  const [formMetricVal, setFormMetricVal] = useState('94.2%');

  const creditsUsed = area.gpu_credits_used ?? 120;
  const creditsBudget = area.gpu_credits_budget ?? 2000;
  const creditsRemaining = Math.max(0, creditsBudget - creditsUsed);

  const handleLaunchTier = (tierId: string) => {
    setIsProvisioning(tierId);
    setTimeout(() => {
      setActiveTier(tierId);
      setIsProvisioning(null);
    }, 700);
  };

  const handleSaveCheckpoint = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;

    const newChk: ModelCheckpoint = {
      id: `chk-${Date.now()}`,
      name: formName.trim(),
      framework: 'PyTorch / Safetensors',
      architecture: formArch.trim() || 'Transformer',
      datasetSplit: 'v1.0.0-active-dataset',
      loss: Number(formLoss) || 0.1,
      metricLabel: formMetricLabel.trim() || 'Score',
      metricValue: formMetricVal.trim() || '95%',
      epochs: 25,
      sizeBytes: '680 MB',
      updatedAt: new Date().toISOString().split('T')[0],
    };

    setCheckpoints([newChk, ...checkpoints]);
    setIsAddCheckpointOpen(false);
    setFormName('');
    setFormArch('');
  };

  const handleDeleteCheckpoint = (id: string) => {
    setCheckpoints(checkpoints.filter((c) => c.id !== id));
    setDeletingCheckpointId(null);
  };

  const handleUninstallModule = async () => {
    const current = (area.enabled_modules as OptionalModuleId[]) || [];
    const updated = current.filter((m) => m !== 'gpu_compute');
    try {
      await scopedClient.updateArea(area.id, {
        enabled_modules: updated,
      } as Partial<ResearchArea>);
      updateAreaLocally({ enabled_modules: updated });
    } catch (err) {
      console.error('Failed to uninstall module', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Module Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-l3 border border-purple-500/30 bg-purple-500/[0.03] p-5 sm:p-6 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-control bg-purple-500/10 text-purple-600 dark:text-purple-400">
              <Icon name="sparkles" size={15} />
            </span>
            <h3 className="text-sm font-bold text-ink">GPU Compute & Model Hub (Modular Add-On)</h3>
            <span className="rounded-pill bg-purple-500/10 px-2 py-0.5 text-[10px] font-mono font-bold text-purple-600 dark:text-purple-400 border border-purple-500/20">
              Air-Gapped Cluster
            </span>
          </div>
          <p className="text-xs text-muted mt-1">
            Rent high-throughput GPU accelerators, provision Jupyter compute kernels, and manage versioned PyTorch checkpoints.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right font-mono text-xs">
            <span className="text-[10px] text-muted block uppercase">GPU Budget Pool</span>
            <span className="font-bold text-ink">{creditsRemaining} cr remaining</span>
            <span className="text-[10px] text-muted block">({creditsUsed} / {creditsBudget} cr used)</span>
          </div>

          <div className="h-8 w-px bg-line" />

          {uninstallConfirm ? (
            <div className="flex items-center gap-1.5 bg-rose-500/10 border border-rose-500/30 p-1.5 rounded-control">
              <span className="text-[11px] font-semibold text-rose-600">Uninstall tool?</span>
              <button
                type="button"
                onClick={() => setUninstallConfirm(false)}
                className="rounded border border-line bg-page px-1.5 py-0.5 text-[10px] text-muted cursor-pointer"
              >
                No
              </button>
              <button
                type="button"
                onClick={handleUninstallModule}
                className="rounded bg-rose-600 px-2 py-0.5 text-[10px] font-bold text-white cursor-pointer"
              >
                Yes
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setUninstallConfirm(true)}
              className="rounded-control border border-line bg-card px-3 py-1.5 text-xs text-muted hover:text-rose-600 transition-colors cursor-pointer"
            >
              Uninstall Module
            </button>
          )}
        </div>
      </div>

      {/* GPU Hardware Tier Selector */}
      <div className="rounded-l3 border border-line bg-card p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-line pb-3">
          <div>
            <h4 className="text-sm font-bold text-ink">On-Demand GPU Hardware Clusters</h4>
            <p className="text-xs text-muted mt-0.5">
              Launch dedicated GPU compute nodes billed dynamically from your research area credits pool.
            </p>
          </div>
          <span className="text-xs font-mono text-muted">Active Node: {activeTier.toUpperCase()}</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {GPU_TIERS.map((tier) => {
            const isActive = activeTier === tier.id;
            const isBusy = isProvisioning === tier.id;

            return (
              <div
                key={tier.id}
                className={`rounded-l2 border p-4 space-y-3 transition-all flex flex-col justify-between ${
                  isActive
                    ? 'border-purple-500 bg-purple-500/5 shadow-xs ring-1 ring-purple-500/40'
                    : 'border-line bg-page hover:border-line-strong'
                }`}
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="rounded bg-card px-2 py-0.5 text-[10px] font-mono font-bold text-muted border border-line">
                      {tier.architecture}
                    </span>
                    {isActive && (
                      <span className="rounded-pill bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                        ● Running
                      </span>
                    )}
                  </div>

                  <h5 className="text-sm font-bold text-ink">{tier.name}</h5>
                  <div className="text-xs font-mono font-semibold text-purple-600 dark:text-purple-400">
                    {tier.vram}
                  </div>
                  <p className="text-xs text-muted leading-relaxed line-clamp-2">{tier.description}</p>
                </div>

                <div className="pt-3 border-t border-line/60 space-y-2">
                  <div className="flex items-baseline justify-between font-mono text-xs">
                    <span className="text-muted">Rate</span>
                    <span className="font-bold text-ink">{tier.costPerHourCredits} cr / hr</span>
                  </div>

                  <Button
                    variant={isActive ? 'secondary' : 'primary'}
                    size="sm"
                    loading={isBusy}
                    onClick={() => handleLaunchTier(tier.id)}
                    className="w-full cursor-pointer text-xs"
                  >
                    {isActive ? 'Attached to Kernel' : 'Launch Node'}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Model Checkpoint Vault */}
      <div className="rounded-l3 border border-line bg-card p-5 sm:p-6 shadow-xs space-y-5">
        <div className="flex items-center justify-between border-b border-line pb-4">
          <div>
            <h4 className="text-sm font-bold text-ink">PyTorch & Safetensors Model Checkpoint Vault</h4>
            <p className="text-xs text-muted mt-0.5">
              Trained neural weights linked directly to observation splits and reproducible ablation runs.
            </p>
          </div>
          <Button
            variant="primary"
            size="sm"
            icon="plus"
            onClick={() => setIsAddCheckpointOpen(true)}
            className="cursor-pointer text-xs"
          >
            + Register Checkpoint
          </Button>
        </div>

        {checkpoints.length === 0 ? (
          <div className="p-8 text-center text-xs text-muted">
            No checkpoints registered yet. Train on an active GPU node or upload a local weights file.
          </div>
        ) : (
          <div className="space-y-3">
            {checkpoints.map((chk) => (
              <div
                key={chk.id}
                className="rounded-l2 border border-line bg-page/40 p-4 shadow-xs hover:border-line-strong transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="space-y-1 max-w-lg">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="flex size-6 items-center justify-center rounded-control bg-page border border-line text-ink">
                      <Icon name="sparkles" size={12} />
                    </span>
                    <h5 className="text-xs sm:text-sm font-bold text-ink font-mono">{chk.name}</h5>
                    <span className="rounded-pill bg-page px-2 py-0.5 text-[10px] font-mono text-muted border border-line">
                      {chk.sizeBytes}
                    </span>
                  </div>
                  <div className="text-xs text-muted">
                    <span>{chk.architecture}</span> • <span className="italic">{chk.datasetSplit}</span>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-xs font-mono">
                  <div className="text-right">
                    <span className="text-[10px] text-muted block uppercase">Train Loss</span>
                    <span className="font-bold text-ink">{chk.loss}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-muted block uppercase">{chk.metricLabel}</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">{chk.metricValue}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-muted block uppercase">Epochs</span>
                    <span className="font-bold text-ink">{chk.epochs}</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setDeletingCheckpointId(chk.id)}
                    title="Delete Checkpoint"
                    className="rounded p-1.5 text-muted hover:text-rose-600 cursor-pointer transition-colors"
                  >
                    <Icon name="trash" size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* MODAL: ADD CHECKPOINT */}
      {isAddCheckpointOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="rounded-l3 border border-line bg-card p-6 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <h4 className="text-sm font-bold text-ink">Register Model Checkpoint</h4>
              <button type="button" onClick={() => setIsAddCheckpointOpen(false)} className="text-muted hover:text-ink cursor-pointer">
                <Icon name="close" size={14} />
              </button>
            </div>

            <form onSubmit={handleSaveCheckpoint} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-ink mb-1">Checkpoint File Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. ByT5-Paleo-Epigraphy-v3.safetensors"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full rounded-control border border-line bg-page px-3 py-2 text-xs text-ink placeholder:text-muted focus:border-purple-500 focus:outline-hidden font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink mb-1">Architecture / Model Family</label>
                <input
                  type="text"
                  placeholder="e.g. Vision Transformer / ByT5 / TrOCR"
                  value={formArch}
                  onChange={(e) => setFormArch(e.target.value)}
                  className="w-full rounded-control border border-line bg-page px-3 py-2 text-xs text-ink placeholder:text-muted focus:border-purple-500 focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-muted mb-1">Loss</label>
                  <input
                    type="text"
                    value={formLoss}
                    onChange={(e) => setFormLoss(e.target.value)}
                    className="w-full rounded-control border border-line bg-page px-2 py-1.5 text-xs text-ink font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-muted mb-1">Metric Label</label>
                  <input
                    type="text"
                    value={formMetricLabel}
                    onChange={(e) => setFormMetricLabel(e.target.value)}
                    className="w-full rounded-control border border-line bg-page px-2 py-1.5 text-xs text-ink"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-muted mb-1">Metric Value</label>
                  <input
                    type="text"
                    value={formMetricVal}
                    onChange={(e) => setFormMetricVal(e.target.value)}
                    className="w-full rounded-control border border-line bg-page px-2 py-1.5 text-xs text-ink font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-line">
                <Button variant="secondary" size="sm" type="button" onClick={() => setIsAddCheckpointOpen(false)} className="cursor-pointer">
                  Cancel
                </Button>
                <Button variant="primary" size="sm" type="submit" className="cursor-pointer bg-purple-600 hover:bg-purple-700 text-white">
                  Save Checkpoint
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: DELETE CHECKPOINT CONFIRMATION */}
      {deletingCheckpointId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="rounded-l2 border border-line bg-card p-5 max-w-sm w-full space-y-4 shadow-xl">
            <div className="flex items-center gap-2 text-rose-600 font-bold text-sm">
              <Icon name="trash" size={16} />
              Confirm Delete Checkpoint
            </div>
            <p className="text-xs text-muted leading-relaxed">
              Are you sure you want to permanently delete this neural model checkpoint?
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button variant="secondary" size="sm" onClick={() => setDeletingCheckpointId(null)} className="cursor-pointer">
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => handleDeleteCheckpoint(deletingCheckpointId)}
                className="bg-rose-600 hover:bg-rose-700 text-white cursor-pointer"
              >
                Delete Checkpoint
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
