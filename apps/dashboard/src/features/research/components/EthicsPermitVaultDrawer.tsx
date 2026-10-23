import React, { useState } from 'react';
import { Button, Drawer, Icon, Skeleton, useResource } from '@layerto/ui';
import type { LayertoClient } from '@layerto/api-client';

export interface EthicsPermitItem {
  id: string;
  area_id: string;
  permit_type:
    | 'irb_approval'
    | 'wildlife_permit'
    | 'data_license'
    | 'cites_permit'
    | 'mta_agreement'
    | 'hipaa_compliance'
    | 'participant_consent'
    | 'clinical_trial_protocol'
    | 'nda_agreement'
    | 'ethics_approval'
    | string;
  permit_number: string;
  issuing_authority: string;
  title: string;
  status: 'active' | 'pending_renewal' | 'expired';
  valid_from: string;
  valid_until: string;
  metadata?: Record<string, any>;
  created_at: string;
}

interface EthicsPermitVaultDrawerProps {
  open: boolean;
  onClose: () => void;
  areaId: string;
  areaName: string;
  scopedClient: LayertoClient;
  customTitle?: string;
}

export function EthicsPermitVaultDrawer({
  open,
  onClose,
  areaId,
  areaName,
  scopedClient,
  customTitle = 'Ethics, IRB & Permit Vault',
}: EthicsPermitVaultDrawerProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [permitType, setPermitType] = useState<string>('wildlife_permit');
  const [permitNumber, setPermitNumber] = useState('');
  const [issuingAuthority, setIssuingAuthority] = useState('');
  const [title, setTitle] = useState('');
  const [validFrom, setValidFrom] = useState(new Date().toISOString().slice(0, 10));
  const [validUntil, setValidUntil] = useState('2028-12-31');
  const [metadataText] = useState('{"lead_pi": "Dr. Lead Biologist", "protocol": "Field Non-Invasive Observation"}');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const permitsResource = useResource<EthicsPermitItem[]>(
    () => scopedClient.researchList<EthicsPermitItem>('ethics-permits', { area: areaId }),
    `ethics-permits-${areaId}`,
  );

  const allPermits = permitsResource.data || [];
  const permits = allPermits.filter((p) => p.area_id === areaId);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!permitNumber.trim() || !title.trim() || !issuingAuthority.trim()) return;

    setError(null);
    setSaving(true);
    let meta = {};
    try {
      meta = metadataText.trim() ? JSON.parse(metadataText) : {};
    } catch {
      setError('Metadata must be a valid JSON object');
      setSaving(false);
      return;
    }

    try {
      await scopedClient.researchCreate('ethics-permits', {
        area_id: areaId,
        permit_type: permitType,
        permit_number: permitNumber.trim(),
        issuing_authority: issuingAuthority.trim(),
        title: title.trim(),
        status: 'active',
        valid_from: validFrom,
        valid_until: validUntil,
        metadata: meta,
      });
      setIsAdding(false);
      setPermitNumber('');
      setIssuingAuthority('');
      setTitle('');
      permitsResource.reload();
    } catch (err: any) {
      console.error('Failed to create permit', err);
      setError(err?.message || 'Failed to save permit');
    } finally {
      setSaving(false);
    }
  };

  const getPermitTypeLabel = (type: string) => {
    switch (type) {
      case 'irb_approval':
        return { label: 'IRB Protocol Approval', color: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/30' };
      case 'hipaa_compliance':
        return { label: 'HIPAA De-ID & Safe Harbor Waiver', color: 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30' };
      case 'clinical_trial_protocol':
        return { label: 'Clinical Trial Registry Protocol', color: 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border-cyan-500/30' };
      case 'participant_consent':
        return { label: 'Informed Participant Consent', color: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30' };
      case 'wildlife_permit':
        return { label: 'Wildlife Research License', color: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30' };
      case 'cites_permit':
        return { label: 'CITES Scientific Permit', color: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30' };
      case 'data_license':
        return { label: 'Data Governance License', color: 'bg-teal-500/10 text-teal-700 dark:text-teal-300 border-teal-500/30' };
      case 'mta_agreement':
        return { label: 'Material Transfer Agreement', color: 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/30' };
      case 'nda_agreement':
        return { label: 'Bilateral NDA & IP Disclosure', color: 'bg-pink-500/10 text-pink-700 dark:text-pink-300 border-pink-500/30' };
      default:
        return { label: 'Compliance Cert', color: 'bg-gray-500/10 text-gray-700 dark:text-gray-300 border-gray-500/30' };
    }
  };

  return (
    <Drawer
      isOpen={open}
      onClose={onClose}
      title={customTitle}
      className="max-w-2xl"
    >
      <div className="space-y-6">
        {/* Air-Gapped Compliance Header */}
        <div className="rounded-control border border-teal-500/30 bg-teal-500/5 p-4 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex size-6 items-center justify-center rounded-control bg-teal-500/20 text-teal-600 dark:text-teal-400">
                <Icon name="shield" size={14} />
              </span>
              <span className="text-xs font-mono font-bold text-teal-700 dark:text-teal-300">
                COMPLIANCE SHIELD: {areaName.toUpperCase()}
              </span>
            </div>
            <span className="rounded bg-teal-500/20 px-2 py-0.5 text-[10px] font-mono font-bold text-teal-800 dark:text-teal-200">
              LEGAL VAULT
            </span>
          </div>
          <p className="text-xs text-muted leading-relaxed">
            All specimens and telemetry collected inside this air-gapped area must link to active IRB approvals,
            wildlife department collection permits, or CITES export/study certs before commercial licensing or public preprint.
          </p>
        </div>

        {/* Action Header */}
        <div className="flex items-center justify-between border-b border-line pb-3">
          <div className="text-xs text-muted font-medium">
            Active Certifications ({permits.length})
          </div>
          <Button
            variant={isAdding ? 'ghost' : 'primary'}
            size="sm"
            icon={isAdding ? 'close' : 'plus'}
            onClick={() => setIsAdding(!isAdding)}
            className="cursor-pointer"
          >
            {isAdding ? 'Cancel' : 'Deposit New Permit'}
          </Button>
        </div>

        {/* Add Permit Form */}
        {isAdding && (
          <form onSubmit={handleCreate} className="rounded-l2 border border-line bg-page p-4 space-y-3 shadow-xs">
            <h4 className="text-xs font-bold text-ink">Deposit Compliance Permit</h4>
            {error && (
              <div className="rounded border border-red-500/30 bg-red-500/10 p-2 text-xs text-red-600">
                {error}
              </div>
            )}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="text-[11px] font-semibold text-muted block mb-1">Permit Classification</label>
                <select
                  value={permitType}
                  onChange={(e) => setPermitType(e.target.value as any)}
                  className="w-full rounded-control border border-line bg-card px-2.5 py-1.5 text-xs text-ink cursor-pointer"
                >
                  <option value="irb_approval">Institutional Review Board (IRB) Protocol</option>
                  <option value="hipaa_compliance">HIPAA Safe Harbor De-ID Data Waiver</option>
                  <option value="clinical_trial_protocol">Clinical Trial Registry Protocol (NCT)</option>
                  <option value="participant_consent">Informed Participant Consent Agreement</option>
                  <option value="wildlife_permit">Wildlife Research & Field Collection License</option>
                  <option value="cites_permit">CITES Non-Commercial Scientific Exchange</option>
                  <option value="data_license">Data Use & Bio-Sample Governance License</option>
                  <option value="mta_agreement">Material Transfer Agreement (MTA)</option>
                  <option value="nda_agreement">Bilateral NDA & Proprietary IP License</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-muted block mb-1">Permit / Protocol #</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. DWC/WP/2026/881 or IRB-2026-WL-0849"
                  value={permitNumber}
                  onChange={(e) => setPermitNumber(e.target.value)}
                  className="w-full rounded-control border border-line bg-card px-2.5 py-1.5 text-xs text-ink"
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-muted block mb-1">Issuing Government / Institutional Body</label>
              <input
                type="text"
                required
                placeholder="e.g. Dept of Wildlife Conservation or University Ethics Board"
                value={issuingAuthority}
                onChange={(e) => setIssuingAuthority(e.target.value)}
                className="w-full rounded-control border border-line bg-card px-2.5 py-1.5 text-xs text-ink"
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold text-muted block mb-1">Permit Title & Scope</label>
              <input
                type="text"
                required
                placeholder="e.g. In-situ Marine Megafauna Photo-ID & Morphometrics Field Study"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-control border border-line bg-card px-2.5 py-1.5 text-xs text-ink"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-muted block mb-1">Valid From</label>
                <input
                  type="date"
                  value={validFrom}
                  onChange={(e) => setValidFrom(e.target.value)}
                  className="w-full rounded-control border border-line bg-card px-2.5 py-1.5 text-xs text-ink"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-muted block mb-1">Valid Until</label>
                <input
                  type="date"
                  value={validUntil}
                  onChange={(e) => setValidUntil(e.target.value)}
                  className="w-full rounded-control border border-line bg-card px-2.5 py-1.5 text-xs text-ink"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => setIsAdding(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm" loading={saving} className="cursor-pointer">
                Deposit to Vault
              </Button>
            </div>
          </form>
        )}

        {/* Permits List */}
        {permitsResource.loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-28 rounded-l2" />
            ))}
          </div>
        ) : permits.length === 0 ? (
          <div className="rounded-l2 border border-line bg-card p-6 text-center text-xs text-muted">
            No compliance permits recorded for this area yet.
          </div>
        ) : (
          <div className="space-y-3">
            {permits.map((p) => {
              const typeInfo = getPermitTypeLabel(p.permit_type);
              return (
                <div
                  key={p.id}
                  className="rounded-l2 border border-line bg-card p-4 shadow-xs space-y-3 hover:border-line-strong transition-all"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className={`rounded-pill border px-2 py-0.5 text-[10px] font-semibold ${typeInfo.color}`}>
                          {typeInfo.label}
                        </span>
                        <span className="font-mono text-xs font-bold text-ink">
                          {p.permit_number}
                        </span>
                      </div>
                      <h5 className="text-xs font-bold text-ink pt-0.5">{p.title}</h5>
                    </div>

                    <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-[10px] font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      {p.status.toUpperCase()}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 gap-1 text-[11px] text-muted sm:grid-cols-2 pt-1 border-t border-line/60">
                    <div>
                      Issuing Body: <strong className="text-ink">{p.issuing_authority}</strong>
                    </div>
                    <div className="font-mono sm:text-right">
                      Validity: {new Date(p.valid_from).toLocaleDateString()} – {p.valid_until ? new Date(p.valid_until).toLocaleDateString() : 'Indefinite'}
                    </div>
                  </div>

                  {p.metadata && Object.keys(p.metadata).length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {Object.entries(p.metadata).map(([k, v]) => (
                        <span
                          key={k}
                          className="rounded bg-page px-2 py-0.5 text-[10px] font-mono text-muted border border-line/60"
                        >
                          {k.replace(/_/g, ' ')}: <strong className="text-ink">{Array.isArray(v) ? v.join(', ') : String(v)}</strong>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Drawer>
  );
}
