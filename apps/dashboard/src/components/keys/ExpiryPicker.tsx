import { Icon, Input, Select } from '@layerto/ui';
import { EXPIRY_OPTIONS, formatExpiryLong, getMaxCustomDate, getMinCustomDate } from '../../lib/keyExpiry';
import type { ExpiryPreset } from '../../lib/keyExpiry';

export interface ExpiryPickerProps {
  preset: ExpiryPreset;
  customDate: string;
  onPresetChange: (p: ExpiryPreset) => void;
  onCustomDateChange: (d: string) => void;
  label?: string;
}

/** "Expires after" select, plus a date field when "Custom date…" is picked. */
export function ExpiryPicker({ preset, customDate, onPresetChange, onCustomDateChange, label = 'Expires after' }: ExpiryPickerProps) {
  return (
    <div className="space-y-3">
      <Select label={label} value={preset} onChange={(e) => onPresetChange(e.target.value as ExpiryPreset)} options={EXPIRY_OPTIONS} />
      {preset === 'custom' && (
        <Input
          label="Expiry date"
          type="date"
          min={getMinCustomDate()}
          max={getMaxCustomDate()}
          value={customDate}
          onChange={(e) => onCustomDateChange(e.target.value)}
          helperText="Up to one year from today. The key stops working at the end of that day."
          required
        />
      )}
    </div>
  );
}

/** One line saying exactly when the key will stop working. */
export function ExpirySummary({ preset, expiresAt, verb = 'will stop' }: { preset: ExpiryPreset; expiresAt: string | null | undefined; verb?: string }) {
  return (
    <div className="flex items-start gap-2 rounded-control border border-line bg-page px-3 py-2.5 text-sm" aria-live="polite">
      {preset === 'never' ? (
        <>
          <Icon name="alert" size={16} className="mt-0.5 shrink-0 text-amber-500" />
          <span className="text-ink-secondary">This key will work until you revoke it. Keys that expire are safer if one ever leaks.</span>
        </>
      ) : expiresAt ? (
        <>
          <Icon name="lock" size={16} className="mt-0.5 shrink-0 text-crimson" />
          <span className="text-ink-secondary">
            This key {verb} working on <strong className="text-ink">{formatExpiryLong(expiresAt)}</strong>. Calls after that get <code>api_key_expired</code>.
          </span>
        </>
      ) : (
        <>
          <Icon name="info" size={16} className="mt-0.5 shrink-0 text-muted" />
          <span className="text-muted">Pick a date for the key to expire.</span>
        </>
      )}
    </div>
  );
}
