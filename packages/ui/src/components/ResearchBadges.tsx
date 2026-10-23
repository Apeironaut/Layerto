import React from 'react';
import { Icon } from './Icon';

export interface ResearchAreaBadgeProps {
  name: string;
  discipline?: string;
  color?: string;
  isolationLevel?: 'air_gapped' | 'federated' | 'standard';
  className?: string;
}

export function ResearchAreaBadge({
  name,
  discipline = 'zoology',
  color = '#06b6d4',
  isolationLevel = 'air_gapped',
  className = '',
}: ResearchAreaBadgeProps) {
  return (
    <div
      className={`inline-flex items-center gap-2 rounded-control border border-line bg-card px-2.5 py-1 text-xs shadow-xs ${className}`}
    >
      <span
        className="size-2 rounded-full shrink-0 animate-pulse"
        style={{ backgroundColor: color }}
      />
      <span className="font-semibold text-ink truncate max-w-[140px]">{name}</span>
      <span className="rounded bg-page px-1.5 py-0.5 text-[10px] font-mono text-muted border border-line/60">
        {discipline}
      </span>
      {isolationLevel === 'air_gapped' && (
        <span className="rounded bg-teal-500/10 px-1.5 py-0.5 text-[9px] font-mono font-bold text-teal-600 dark:text-teal-400">
          AIR-GAPPED
        </span>
      )}
    </div>
  );
}

export interface GeoShieldBadgeProps {
  fuzzed?: boolean;
  onToggle?: () => void;
  className?: string;
}

export function GeoShieldBadge({
  fuzzed = true,
  onToggle,
  className = '',
}: GeoShieldBadgeProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`inline-flex cursor-pointer items-center gap-1.5 rounded-pill px-2.5 py-1 text-xs font-medium transition-all ${
        fuzzed
          ? 'border border-teal-500/30 bg-teal-500/10 text-teal-700 dark:text-teal-300 hover:bg-teal-500/20'
          : 'border border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20'
      } ${className}`}
      title={
        fuzzed
          ? 'EXIF & GPS coordinates masked (±10km conservation fuzzing active)'
          : 'Warning: Raw telemetry coordinates exposed'
      }
    >
      <Icon name={fuzzed ? 'shield' : 'globe'} size={13} />
      <span>{fuzzed ? 'Geo-Shield: Protected' : 'Geo-Shield: Raw GPS'}</span>
    </button>
  );
}

export interface AdaptivePrivacyShieldBadgeProps {
  shieldType?: 'geo_privacy' | 'hipaa_dicom' | 'nlp_pii' | 'nda_watermark' | string;
  enabled?: boolean;
  onToggle?: () => void;
  className?: string;
}

export function AdaptivePrivacyShieldBadge({
  shieldType = 'geo_privacy',
  enabled = true,
  onToggle,
  className = '',
}: AdaptivePrivacyShieldBadgeProps) {
  const getMeta = () => {
    switch (shieldType) {
      case 'hipaa_dicom':
        return {
          onLabel: 'HIPAA Shield: ON (Scrub Patient PII & DICOM)',
          offLabel: 'HIPAA Shield: OFF (Raw Patient Records)',
          descOn: 'Patient MRN, names, DOB and DICOM headers scrubbed under HIPAA Safe Harbor.',
          descOff: 'Warning: Unscrubbed medical records exposed.',
          icon: 'shield' as const,
        };
      case 'nlp_pii':
        return {
          onLabel: 'PII Shield: ON (Pseudonymize Informants)',
          offLabel: 'PII Shield: OFF (Raw Transcripts)',
          descOn: 'Speaker names, contact info and sensitive entities redacted.',
          descOff: 'Warning: Raw speaker transcripts exposed.',
          icon: 'shield' as const,
        };
      case 'nda_watermark':
        return {
          onLabel: 'NDA Shield: ON (Cryptographic Fingerprint)',
          offLabel: 'NDA Shield: OFF (Unwatermarked)',
          descOn: 'Zero-knowledge digital watermarking and proprietary IP fingerprint active.',
          descOff: 'Warning: Proprietary formulas and architectures exposed.',
          icon: 'shield' as const,
        };
      case 'geo_privacy':
      default:
        return {
          onLabel: 'Geo-Shield: ON (±10km Blur)',
          offLabel: 'Geo-Shield: OFF (Raw Telemetry)',
          descOn: 'EXIF & GPS coordinates fuzzed to protect endangered species habitats.',
          descOff: 'Warning: Precise coordinates exposed.',
          icon: 'globe' as const,
        };
    }
  };

  const meta = getMeta();

  return (
    <button
      type="button"
      onClick={onToggle}
      className={`inline-flex cursor-pointer items-center gap-1.5 rounded-pill px-3 py-1 text-xs font-semibold transition-all ${
        enabled
          ? 'border border-teal-500/40 bg-teal-500/10 text-teal-700 dark:text-teal-300 hover:bg-teal-500/20 shadow-xs'
          : 'border border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20'
      } ${className}`}
      title={enabled ? meta.descOn : meta.descOff}
    >
      <Icon name={enabled ? 'shield' : meta.icon} size={13} />
      <span>{enabled ? meta.onLabel : meta.offLabel}</span>
    </button>
  );
}

export interface AirGappedVaultCardProps {
  title: string;
  discipline: string;
  storageQuotaBytes?: number;
  storageBytesUsed?: number;
  gpuCreditsBudget?: number;
  gpuCreditsUsed?: number;
  children?: React.ReactNode;
  className?: string;
}

export function AirGappedVaultCard({
  title,
  discipline,
  storageQuotaBytes = 53687091200,
  storageBytesUsed = 0,
  gpuCreditsBudget = 1000,
  gpuCreditsUsed = 0,
  children,
  className = '',
}: AirGappedVaultCardProps) {
  const storagePct = Math.min(100, Math.round((storageBytesUsed / Math.max(storageQuotaBytes, 1)) * 100));
  const gpuPct = Math.min(100, Math.round((gpuCreditsUsed / Math.max(gpuCreditsBudget, 1)) * 100));

  return (
    <div
      className={`rounded-l2 border border-line bg-card p-5 shadow-l1 hover:border-line-strong transition-all space-y-4 ${className}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-bold text-ink">{title}</h4>
            <span className="rounded bg-teal-500/10 px-1.5 py-0.5 text-[9px] font-mono font-bold text-teal-600 dark:text-teal-400">
              ZERO-TRUST VAULT
            </span>
          </div>
          <p className="text-xs text-muted mt-0.5 capitalize">{discipline} Research Area</p>
        </div>
      </div>

      <div className="space-y-2 pt-2 border-t border-line/60">
        <div>
          <div className="flex justify-between text-[11px] text-muted font-mono">
            <span>Storage Quota</span>
            <span>{storagePct}%</span>
          </div>
          <div className="mt-1 h-1.5 w-full rounded-full bg-line overflow-hidden">
            <div className="h-full bg-teal-500" style={{ width: `${storagePct}%` }} />
          </div>
        </div>
        <div>
          <div className="flex justify-between text-[11px] text-muted font-mono">
            <span>GPU Allocation</span>
            <span>{gpuPct}%</span>
          </div>
          <div className="mt-1 h-1.5 w-full rounded-full bg-line overflow-hidden">
            <div className="h-full bg-crimson" style={{ width: `${gpuPct}%` }} />
          </div>
        </div>
      </div>

      {children}
    </div>
  );
}

export interface CRediTRoleTagProps {
  role: string;
  className?: string;
}

export function CRediTRoleTag({ role, className = '' }: CRediTRoleTagProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded bg-page px-2 py-0.5 text-[11px] font-medium text-ink-secondary border border-line ${className}`}
      title={`Contributor Roles Taxonomy (CRediT): ${role}`}
    >
      <span className="size-1.5 rounded-full bg-indigo-500" />
      <span>{role}</span>
    </span>
  );
}
